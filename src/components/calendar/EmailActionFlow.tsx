import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentActionWire } from '../../hooks/useAgentAction';
import { useApproveAgentAction } from '../../hooks/useAgentAction';
import { useCreateGmailDraft, useSendGmailDraft } from '../../hooks/useGmailActions';
import { useToast } from '../../hooks/useToast';
import { extractEmailDraft, extractSendDraftId } from '../../lib/agentProposal';
import AgentActionPanel from '../AgentActionPanel';
import RequiresPro from '../RequiresPro';

type EmailFlowState = 'approving' | 'executing' | 'done' | 'failed';

interface EmailActionFlowProps {
  action: AgentActionWire;
}

/**
 * Email response flow for `draft_email` and `send_email` actions (FE-021,
 * backend BE-034). Draft creation is a Level 2 approval; sending is Level 3
 * (destructive outbound email — red, unmistakable). Approving records the
 * consent (BE-032) and the Gmail route then claims and verifies the action.
 *
 * The proposed content is AI-generated and rendered verbatim — never
 * translated, never editable here.
 */
const EmailActionFlow = ({ action }: EmailActionFlowProps) => {
  const { t } = useTranslation('calendar');
  const toast = useToast();

  const approveAction = useApproveAgentAction();
  const createDraft = useCreateGmailDraft();
  const sendDraft = useSendGmailDraft();

  const isSend = action.actionType === 'send_email';
  const draft = isSend ? null : extractEmailDraft(action.requestPayload);
  const draftId = isSend ? extractSendDraftId(action.requestPayload) : null;
  const missingInput = isSend ? draftId === null : draft === null;

  const [flowState, setFlowState] = useState<EmailFlowState>(
    missingInput ? 'failed' : 'approving',
  );
  const [failure, setFailure] = useState<string | null>(
    missingInput ? t('email.noDraft') : null,
  );

  const run = async () => {
    setFlowState('executing');
    setFailure(null);
    try {
      await approveAction.mutateAsync(action.id);
      if (isSend) {
        await sendDraft.mutateAsync({ agentActionId: action.id, draftId: draftId as string });
        toast.success(t('email.sentToast'));
      } else {
        const content = draft as NonNullable<typeof draft>;
        await createDraft.mutateAsync({
          agentActionId: action.id,
          to: content.to ?? '',
          subject: content.subject ?? '',
          body: content.body ?? '',
          threadId: content.threadId,
        });
        toast.success(t('email.draftCreatedToast'));
      }
      setFlowState('done');
    } catch (error) {
      console.error('[EmailActionFlow] execution failed', error);
      setFailure(isSend ? t('errors.send') : t('errors.draft'));
      setFlowState('failed');
    }
  };

  if (isSend) {
    return (
      <RequiresPro feature="emailActions">
        <AgentActionPanel
          state={flowState}
          approvalDescription={flowState === 'approving' ? t('email.sendPrompt') : undefined}
          approvalLevel={3}
          onApprove={flowState === 'approving' ? () => void run() : undefined}
          executingLabel={t('email.sending')}
          resultSummary={flowState === 'done' ? t('email.sent') : undefined}
          errorMessage={flowState === 'failed' ? failure ?? undefined : undefined}
        />
      </RequiresPro>
    );
  }

  return (
    <RequiresPro feature="emailActions">
      {draft !== null && (
        <div className="space-y-2" data-testid="email-draft-proposal">
          <p className="text-sm font-semibold text-gray-900">{t('email.draftHeading')}</p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{t('email.draftToLabel')}:</span> {draft.to ?? ''}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">{t('email.draftSubjectLabel')}:</span> {draft.subject ?? ''}
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{draft.body ?? ''}</p>
        </div>
      )}
      <AgentActionPanel
        state={flowState}
        approvalDescription={flowState === 'approving' ? t('email.approveDraft') : undefined}
        approvalLevel={2}
        onApprove={flowState === 'approving' ? () => void run() : undefined}
        executingLabel={t('email.sending')}
        resultSummary={flowState === 'done' ? t('email.draftCreatedToast') : undefined}
        errorMessage={flowState === 'failed' ? failure ?? undefined : undefined}
      />
    </RequiresPro>
  );
};

export default EmailActionFlow;
