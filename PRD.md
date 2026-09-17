# Inbox Detective

## Product Requirements Document — Production V1

**Version:** 1.1
**Target:** Production launch
**Product:** Consumer AI / Agentic Email Assistant
**Primary integration:** Gmail
**Secondary integration:** Google Calendar
**Payments:** Stripe
**Business model:** Freemium SaaS

---

# 1. Executive Summary

Inbox Detective is an AI agent that investigates a user's inbox, discovers information worth their attention, remembers relevant information over time, recommends actions, and—with the user's permission—takes action.

Inbox Detective is not designed to help users read more email.

Its purpose is to help users avoid needing to read email by identifying the things buried inside their inbox that actually matter.

Examples include:

* Forgotten subscriptions
* Subscription renewals
* Price increases
* Expiring credits
* Unused benefits
* Refunds
* Discounts
* Trial expirations
* Meeting requests
* Deadlines
* Account changes
* Important actions
* Financial opportunities

The core product loop is:

OBSERVE → FILTER → UNDERSTAND → REMEMBER → DETECT → DECIDE → RECOMMEND → ACT → VERIFY → LEARN

The commercial model follows one simple principle:

**Free = Investigation. Pro = Agent.**

A free user gets enough of the investigation to experience the value of Inbox Detective.

A Pro user gets a persistent agent that continuously monitors the inbox and helps take action.

---

# 2. Product Vision

## Vision

Build a personal AI agent that understands the user's inbox as an evolving source of knowledge rather than a collection of individual messages.

## Product promise

**Your inbox knows things you don't.**

Inbox Detective finds those things and helps you take care of them.

## Positioning

Inbox Detective should not be positioned as:

* Another email client
* Inbox zero software
* Email summarization software
* Newsletter summarizer
* Gmail search with AI
* Generic chatbot over Gmail

Instead:

> Inbox Detective continuously investigates your inbox for things worth knowing and doing.

---

# 3. User Problem

Important information is frequently buried inside email.

Users receive:

* Receipts
* Renewals
* Promotional offers
* Account notifications
* Scheduling requests
* Bills
* Refund confirmations
* Loyalty benefits
* Trial notifications
* Price-change notices
* Travel information
* Subscription changes

The user is expected to manually identify which messages matter.

This creates several problems:

1. Valuable information gets missed.
2. Deadlines expire.
3. Subscriptions renew unexpectedly.
4. Price increases go unnoticed.
5. Credits remain unused.
6. Refunds aren't followed up.
7. Meeting requests are forgotten.
8. Users spend time repeatedly reviewing email.

Inbox Detective changes the question from:

**"What emails haven't I read?"**

to:

**"Is there anything in my inbox I should know or do?"**

---

# 4. Target Customer

Production V1 targets individual Gmail users.

Primary customer:

* Busy professional
* Large personal inbox
* Receives 50+ emails/day
* Multiple subscriptions
* Shops online
* Receives promotions and benefits
* Schedules meetings through email
* Does not maintain inbox zero
* Has difficulty tracking everything received through email

Initial product is consumer/prosumer.

V1 does NOT target:

* Enterprise deployments
* Shared inboxes
* Customer support teams
* Sales teams
* Google Workspace administration
* Corporate compliance workflows

---

# 5. Product Principles

## 5.1 Discover, don't summarize

A summary says:

> "Adobe sent you a renewal email."

A discovery says:

> "Adobe renews for $59.99 next week. That's approximately $720/year."

The second is the product.

## 5.2 Emails are evidence

The product should not revolve around emails.

An email is a source.

The primary domain object is a **Discovery**.

## 5.3 Remember across time

The agent should understand historical changes.

For example:

August Verizon bill:

$177.66

September Verizon bill:

$194.21

Inbox Detective should produce:

> Your Verizon bill increased $16.55/month, approximately $198.60/year.

## 5.4 Recommend before acting

The system should identify a problem and propose an appropriate action.

## 5.5 User controls consequential actions

High-impact actions require explicit approval.

## 5.6 Verify actions

An action is not complete because a tool call succeeded.

Inbox Detective must attempt to verify the expected result.

## 5.7 Explain everything

Users must be able to understand why a discovery exists.

---

# 6. Agent Architecture

The core loop is:

OBSERVE
↓
FILTER
↓
UNDERSTAND
↓
REMEMBER
↓
DETECT
↓
DECIDE
↓
RECOMMEND
↓
ACT
↓
VERIFY
↓
LEARN

### Observe

Receive and synchronize emails.

### Filter

Determine which messages potentially contain useful information.

### Understand

Extract structured information using AI.

### Remember

Update persistent knowledge about companies, subscriptions, events, amounts and user preferences.

### Detect

Identify meaningful patterns or events.

### Decide

Determine whether the discovery deserves the user's attention.

### Recommend

Determine appropriate actions.

### Act

Execute an approved tool.

### Verify

Confirm that the expected outcome occurred.

### Learn

Use feedback and historical behavior to improve relevance.

---

# 7. Core Discovery Types

Production V1 should prioritize five categories.

## 7.1 Money

Detect:

* Credits
* Refunds
* Rewards
* Cashback
* Gift cards
* Promotional balances
* Potential savings
* Reimbursements

Example:

**$50 Amex credit available**

Expires September 30.

Potential action:

**Remind me**

---

# 8. Subscriptions

Detect:

* Service
* Plan
* Price
* Frequency
* Renewal date
* Trial expiration
* Price changes
* Cancellation information

Example:

**Adobe Creative Cloud**

$59.99/month

Renews September 24.

Approximately $719.88/year.

Actions:

* Review subscription
* Remind me
* View source email
* Open provider

Automated universal subscription cancellation is NOT required for V1.

Future versions may introduce:

**Cancel for me**

when reliable automation exists.

---

# 9. Expirations

Detect expiration of:

* Credits
* Offers
* Benefits
* Coupons
* Trials
* Rewards
* Promotional balances

Attempt to extract:

* Company
* Value
* Expiration
* Conditions
* Source
* Confidence

Example:

**$100 travel credit**

Expires in 12 days.

Action:

**Remind me before expiration**

---

# 10. Meeting Requests

Detect scheduling intent.

Examples:

* "Are you free Tuesday?"
* "Let's schedule a call."
* "Can you send me your availability?"
* "Would Wednesday afternoon work?"
* "Here's my Calendly."

Create a `meeting_request` event.

Available action:

**Find a time**

Inbox Detective should then:

1. Understand the request.
2. Identify participants.
3. Determine requested timeframe.
4. Check Google Calendar.
5. Find available times.
6. Present options.
7. Allow the user to select one.
8. Create the event.
9. Draft an email response.
10. Ask for approval before sending.

---

# 11. Change Detection

Inbox Detective should compare current information with historical memory.

Examples:

* Subscription price increases
* Bill increases
* Plan changes
* Renewal changes
* Account changes

Example:

**Verizon price increase detected**

Previous:

$177.66/month

Current:

$194.21/month

Difference:

+$16.55/month

Approximately:

+$198.60/year

Action:

**Investigate**

---

# 12. Discovery Object

A Discovery is the primary user-facing domain object.

Example structure:

{
"type": "subscription_renewal",
"title": "Adobe renews next week",
"company": "Adobe",
"amount": 59.99,
"currency": "USD",
"date": "2026-09-24",
"confidence": 0.97,
"importance": "high",
"status": "active",
"requiresAction": false,
"sourceEmails": ["gmail-message-id"],
"availableActions": [
"review_subscription",
"remind",
"dismiss"
]
}

---

# 13. Detective Memory

Inbox Detective should maintain structured persistent knowledge.

Conceptually:

User

→ Companies
→ Subscriptions
→ Prices
→ Benefits
→ Offers
→ Meetings
→ Refunds
→ Account events
→ Preferences
→ Historical discoveries

Example:

Adobe

* Product: Creative Cloud
* Current price: $59.99
* Previous price: $52.99
* Frequency: monthly
* Renewal: September 24
* Historical emails
* Historical discoveries

Structured memory should be queried before searching raw emails whenever possible.

---

# 14. Agent Actions

Discoveries expose contextual actions.

Example:

Subscription:

**Review subscription**

Meeting:

**Find a time**

Credit:

**Remind me**

Price increase:

**Investigate**

Refund:

**Track refund**

The agent should determine which actions are appropriate for each discovery.

---

# 15. Action Permission Model

Three action levels are required.

## Level 1 — Automatic

No user confirmation required.

Examples:

* Analyze email
* Classify information
* Update memory
* Detect subscription
* Compare historical prices
* Generate discovery

## Level 2 — Approval

User approves before execution.

Examples:

* Create reminder
* Create calendar event
* Draft response

## Level 3 — Explicit approval

Consequential actions require explicit confirmation.

Examples:

* Send email
* Cancel subscription
* Modify external account
* Future financial actions

Inbox Detective must never silently perform Level 3 actions.

---

# 16. Gmail Integration

V1 capabilities:

### Read

* Search messages
* Retrieve message
* Retrieve thread
* Retrieve metadata
* Synchronize inbox

### Understand

* Analyze thread
* Extract events
* Extract dates
* Extract monetary values
* Identify companies
* Identify intent

### Actions

* Draft response
* Send approved response

Sending requires explicit user approval.

---

# 17. Google Calendar Integration

Capabilities:

* Retrieve events
* Determine availability
* Find open slots
* Create events
* Update events

Example:

**Meeting request detected**

Sarah wants to meet Tuesday afternoon.

Inbox Detective checks Calendar:

2:00 PM available
3:30 PM available
4:30 PM available

User chooses:

**2:00 PM**

Agent:

✓ Creates event

✓ Drafts response

User approves:

✓ Sends response

---

# 18. Reminder System

Discoveries can generate reminders.

Examples:

* Subscription renewal
* Credit expiration
* Trial ending
* Meeting response required
* Offer expiration

Suggested options:

**Tomorrow**

**3 days before**

**7 days before**

**1 day before**

**Custom**

Pro users receive persistent proactive reminders.

---

# 19. Detective Dashboard

The dashboard should NOT resemble Gmail.

Example:

**Good morning, Jose.**

Your Detective found:

**3 things worth your attention**

### Money Found

$127 potential value

### Subscriptions

$184/month detected

### Needs Attention

3 items

### Recent discoveries

**Verizon increased your bill $16.55**

→ Investigate

**$50 Amex credit expires Sep 30**

→ Remind me

**Sarah wants to schedule a meeting**

→ Find a time

**Adobe renews Sep 24**

→ Review subscription

---

# 20. Detective Chat

Users can ask:

* What subscriptions am I paying for?
* What expires this month?
* Did anything increase in price?
* How much am I spending on subscriptions?
* Did Amazon refund me?
* What needs my attention?
* What meetings do I need to schedule?
* What money am I potentially leaving unused?

The agent should:

1. Query structured memory.
2. Retrieve relevant discoveries.
3. Retrieve source emails only when necessary.
4. Answer with source traceability.

---

# 21. Explainability

Every discovery must provide:

**Why did you flag this?**

Example:

> Adobe emailed you on September 14 confirming that your Creative Cloud subscription renews for $59.99 on September 24.
>
> Your previous recorded price was $52.99.

Source:

**View email**

This capability is mandatory for user trust.

---

# 22. Feedback

Every discovery supports:

**Useful**

**Not useful**

**Don't show me things like this**

Feedback updates relevance preferences.

The long-term relevance model combines:

Global detection quality
+
User preferences
+
Historical feedback
+
Past actions

---

# 23. Free vs Pro Product Strategy

The product follows:

# Free = Investigation

# Pro = Agent

The Free product proves Inbox Detective's value.

The Pro product continuously delivers and acts on that value.

---

# 24. Free Tier

**Price: $0**

Purpose:

Deliver the product's aha moment without requiring payment information.

Free users can:

* Create an account
* Connect Gmail
* Run initial inbox investigation
* Analyze approximately 500–1,000 recent emails
* Receive an investigation summary
* See the first 3–5 discoveries
* Preview detected subscriptions
* Preview money found
* Preview expiring benefits
* Preview price changes
* View source evidence for unlocked discoveries
* Ask a limited number of Detective questions

Free users do NOT receive:

* Continuous monitoring
* Full discovery history
* Unlimited discoveries
* Daily Detective Briefing
* Persistent reminders
* Calendar actions
* Agent actions
* Full historical comparisons
* Continuous subscription monitoring

The exact numerical limits should be configurable server-side rather than hard-coded.

---

# 25. Free Investigation Experience

The free investigation must deliver real value before showing the paywall.

Example:

**Investigation complete 🔎**

843 emails analyzed

11 discoveries found

$184 potential value identified

7 subscriptions detected

3 upcoming expirations

Then:

### Your first discoveries

**$50 credit expires September 30**

**Adobe renews next week**

**Your Verizon bill increased**

Then:

**8 additional discoveries found 🔒**

Unlock your complete investigation and keep your Detective working.

**Upgrade to Pro**

The user should understand exactly what value exists behind the upgrade.

---

# 26. No Traditional Free Trial for V1

V1 will NOT require a traditional seven-day or fourteen-day Pro trial.

The initial free investigation functions as the trial.

The acquisition funnel becomes:

Visit
↓
Connect Gmail
↓
Investigation
↓
Discovery
↓
Aha moment
↓
Additional discoveries locked
↓
Upgrade
↓
Stripe Checkout
↓
Pro activated

No credit card is required to experience initial value.

---

# 27. Pro Tier

**Launch target price: $5.99/month**

Potential annual option:

**$49/year**

Pricing must be configurable through Stripe.

Pro includes:

* Continuous Gmail monitoring
* Full discoveries
* Larger historical investigation
* Subscription tracking
* Price-change detection
* Expiration monitoring
* Money/credit monitoring
* Persistent memory
* Reminders
* Daily Detective Briefing
* Google Calendar integration/actions
* Meeting scheduling workflows
* Email drafting
* Approved agent actions
* Detective Chat
* Historical comparisons
* Full discovery history

The product should avoid promising literal unlimited AI usage.

Use reasonable-use limits internally.

---

# 28. Upgrade Triggers

The paywall should appear contextually.

Good triggers include:

### Discovery limit

**Your Detective found 8 more things.**

Upgrade to reveal them.

### Action

Free user clicks:

**Find a time**

Response:

> Calendar actions are available with Inbox Detective Pro.

### Continuous monitoring

> Want me to keep watching this subscription?

**Keep monitoring with Pro**

### Reminder

> Want me to remind you before this expires?

**Enable proactive reminders with Pro**

The paywall should relate directly to something the user wants to accomplish.

---

# 29. Payment Integration

Use Stripe.

Required capabilities:

* Stripe Checkout
* Monthly subscription
* Annual subscription
* Customer Portal
* Webhooks
* Subscription entitlement
* Cancellation
* Payment-method management
* Billing history

Do NOT build custom credit-card handling.

---

# 30. Billing Flow

User clicks:

**Upgrade to Pro**

↓

Backend creates Stripe Checkout Session

↓

Stripe Checkout

↓

Payment completed

↓

Stripe webhook received

↓

Backend updates subscription

↓

Pro entitlement activated

↓

User returns to Inbox Detective

↓

Locked discoveries immediately unlock

The last step is important.

The user should return from checkout directly to the value that caused them to pay.

---

# 31. Billing Data

Minimum billing state:

User

* stripeCustomerId
* stripeSubscriptionId
* plan
* subscriptionStatus
* currentPeriodEnd
* cancelAtPeriodEnd

Stripe webhook state is authoritative.

The frontend must NOT determine subscription status.

---

# 32. Required Stripe Webhooks

Handle at minimum:

* checkout.session.completed
* customer.subscription.created
* customer.subscription.updated
* customer.subscription.deleted
* invoice.paid
* invoice.payment_failed

Webhook processing must be idempotent.

---

# 33. Customer Billing Portal

Pro users should be able to select:

**Manage subscription**

The Stripe Customer Portal should handle:

* Update payment method
* View invoices
* Change subscription
* Cancel subscription

Inbox Detective should not recreate this functionality.

---

# 34. Authentication & OAuth

Primary authentication:

**Continue with Google**

Recommended onboarding:

Landing page
↓
Sign in with Google
↓
Create account
↓
Explain Gmail permissions
↓
Authorize Gmail
↓
Start investigation

Calendar permissions should preferably be requested when the user first attempts a scheduling capability.

This reduces unnecessary initial permissions.

---

# 35. Privacy & Trust

Because Inbox Detective accesses private email, trust is a core product requirement.

Production launch requires:

* Privacy Policy
* Terms of Service
* Delete account
* Delete imported data
* Disconnect Gmail
* Disconnect Calendar
* Secure OAuth token storage
* Encryption in transit
* Encryption at rest where appropriate
* Minimal OAuth scopes
* No OAuth tokens in logs
* No email bodies in application logs
* Agent action audit trail

The product must not claim certifications that have not actually been obtained.

---

# 36. AI Processing Pipeline

Production processing should use progressive filtering.

Example:

10,000 emails
↓
Metadata/sender filtering
↓
4,000 candidates
↓
Rules / lightweight classification
↓
800 relevant candidates
↓
LLM structured extraction
↓
150 events
↓
Deduplication
↓
35 discoveries
↓
Importance/relevance reasoning
↓
12 meaningful discoveries

During initial development and unlimited-token testing, quality can be prioritized over cost.

Production architecture must support later model-routing optimization.

---

# 37. Structured Extraction

AI output must be structured.

Example:

{
"relevant": true,
"category": "subscription",
"company": "Adobe",
"event": "renewal",
"amount": 59.99,
"currency": "USD",
"frequency": "monthly",
"eventDate": "2026-09-24",
"requiresAction": false,
"confidence": 0.97
}

The LLM should NOT directly manipulate persistent application state.

Application services validate AI output before persistence.

---

# 38. Agent Tools

Tools should be explicit capabilities.

## Email

* searchEmails()
* getEmail()
* getThread()
* draftEmail()
* sendEmail()

## Calendar

* getAvailability()
* getEvents()
* createEvent()
* updateEvent()

## Memory

* searchEntities()
* getSubscription()
* getCompanyHistory()
* saveEvent()
* updateDiscovery()

## Reminder

* createReminder()
* cancelReminder()

## Subscription

* findSubscription()
* calculateAnnualCost()
* getPriceHistory()

## Detective

* createDiscovery()
* dismissDiscovery()
* explainDiscovery()
* proposeAction()
* executeApprovedAction()
* verifyAction()

---

# 39. Agent Execution Safety

Tool execution follows:

Trigger
↓
Agent reasoning
↓
Proposed plan
↓
Tool request
↓
Policy evaluation
↓
Approval required?

If yes:

User approval

↓

Execute

↓

Verify

↓

Audit

Every meaningful agent action must generate an auditable execution record.

---

# 40. Background Processing

Recommended architecture:

Gmail Sync
↓
Queue
↓
Email Processor
↓
Structured Extraction
↓
Event Processor
↓
Memory Update
↓
Detective Reasoning
↓
Discovery Generation
↓
Notification/Briefing

Background processing must tolerate:

* Retries
* Duplicate events
* Partial failures
* LLM failures
* Gmail API failures

Jobs should therefore be idempotent wherever possible.

---

# 41. Core Domain Entities

Conceptual entities:

* users
* oauth_connections
* emails
* email_threads
* entities
* companies
* events
* subscriptions
* price_history
* benefits
* offers
* meeting_requests
* discoveries
* discovery_sources
* actions
* action_executions
* reminders
* user_preferences
* agent_feedback
* billing_customers
* billing_subscriptions
* audit_logs

Existing schemas may consolidate some of these domains.

---

# 42. Daily Detective Briefing

Pro users receive a concise proactive briefing.

Example:

**Your Detective Briefing 🔎**

3 things need attention.

**$50 credit**

Expires in 5 days.

**Adobe**

Renews next week — $59.99.

**Meredith**

Waiting for your availability.

Potential value identified:

**$109.99**

The briefing should prioritize actionable information rather than email summaries.

---

# 43. Product Analytics

Required funnel:

Landing
↓
Signup
↓
Gmail connected
↓
Investigation started
↓
Investigation completed
↓
First discovery viewed
↓
Useful discovery
↓
Paywall viewed
↓
Checkout started
↓
Payment completed
↓
Pro activated
↓
First Pro action

Track:

* Signup conversion
* Gmail authorization conversion
* Investigation completion rate
* Time to first discovery
* Discoveries per investigation
* Useful discovery rate
* Paywall conversion
* Checkout conversion
* Free → Pro conversion
* Action acceptance
* Reminder usage
* Calendar usage
* Monthly retention
* Cancellation rate
* Value identified per user

---

# 44. Potential North-Star Metric

A long-term north-star metric:

**Value recovered or protected per active user**

Example:

> Inbox Detective identified $86 of value for you this month.

This creates a direct relationship between product price and customer value.

---

# 45. Landing Page

Primary hero:

# Your inbox knows things you don't.

Inbox Detective finds forgotten subscriptions, expiring credits, price increases, refunds, deadlines and things requiring your attention—and helps you take action.

**Investigate my inbox**

Secondary message:

**Connect Gmail. See what you've been missing.**

The landing page should sell outcomes rather than AI architecture.

---

# 46. Onboarding

Example:

**Welcome to Inbox Detective 🔎**

What should your Detective investigate?

☑ Subscriptions

☑ Money & credits

☑ Expiring offers

☑ Price increases

☑ Meetings

☑ Important actions

**Start investigation**

Investigation progress:

**Investigating your inbox...**

2,142 emails reviewed

8 subscriptions found

4 expiring benefits found

2 price changes detected

3 action items identified

**Building your briefing...**

---

# 47. Production V1 — P0

The following must work for launch:

1. Google authentication
2. User onboarding
3. Gmail OAuth
4. Gmail historical synchronization
5. Background processing
6. Structured AI extraction
7. Persistent memory
8. Discovery generation
9. Money detection
10. Subscription detection
11. Expiration detection
12. Price/change detection
13. Meeting detection
14. Discovery dashboard
15. Discovery details
16. Source-email traceability
17. Free investigation limits
18. Locked discoveries
19. Paywall
20. Stripe Checkout
21. Stripe webhooks
22. Pro entitlement
23. Stripe Customer Portal
24. Reminder action
25. Calendar OAuth
26. Calendar availability
27. Create calendar event
28. Draft email response
29. Detective Chat
30. Feedback
31. Privacy Policy
32. Terms
33. Disconnect Google
34. Account/data deletion
35. Error monitoring
36. Production analytics
37. Production deployment

---

# 48. P1 — After Launch

Do not block tomorrow's launch for:

* Automated universal subscription cancellation
* Outlook
* Mobile application
* Team accounts
* Shared inbox
* Enterprise features
* Slack
* Financial account integrations
* Advanced browser automation
* Multiple paid plans
* Family plans
* Native push notifications
* Autonomous purchases
* Complex multi-agent systems

---

# 49. Launch Definition of Done

Inbox Detective is launchable when a completely new user can independently:

Visit product
↓
Understand product
↓
Create account
↓
Connect Gmail
↓
Start investigation
↓
Receive genuine discoveries
↓
Understand why they were flagged
↓
View source evidence
↓
Hit Free limits
↓
Understand Pro value
↓
Pay through Stripe
↓
Become Pro automatically
↓
Unlock discoveries
↓
Connect Calendar when needed
↓
Take an agent action
↓
Receive confirmation
↓
Manage subscription

without developer intervention.

---

# 50. Launch Demo

The ideal demo:

A new user connects a real Gmail account.

**Investigating...**

4,823 emails reviewed.

Then:

**Investigation complete 🔎**

17 things worth your attention.

$287 potential value identified.

### Discovery #1

**$50 credit expires in 9 days**

→ Remind me

Free user attempts reminder:

**Keep your Detective working with Pro.**

### Discovery #2

**Adobe renews for $59.99 next week**

→ Review subscription

### Discovery #3

**Your internet bill increased $14/month**

→ Investigate

Then:

**14 additional discoveries 🔒**

User upgrades.

Stripe Checkout.

Payment completes.

Return to application:

**Welcome to Inbox Detective Pro 🔎**

All discoveries unlock.

Next discovery:

**Rebecca wants to schedule a call**

→ Find a time

Inbox Detective checks Calendar.

Tuesday 2 PM
Tuesday 4 PM
Wednesday 11 AM

User selects Tuesday 2 PM.

✓ Calendar event created.

✓ Email response drafted.

User approves.

✓ Response sent.

Finally:

User asks:

**How much am I spending on subscriptions?**

Inbox Detective responds using persistent memory.

---

# 51. Core Business Thesis

The entire product should reinforce one distinction:

## FREE

**"I'll investigate your inbox and show you what you've been missing."**

## PRO

**"I'll keep watching—and help you take care of it."**

That distinction should drive product permissions, UX, pricing, onboarding, paywalls, landing-page messaging, and engineering decisions for V1.
