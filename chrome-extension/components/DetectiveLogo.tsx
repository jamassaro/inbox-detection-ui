interface DetectiveLogoProps {
  className?: string;
}

/** Inbox Detective mark (same paths as public/logo.svg), inlined so it needs no network or CSP allowance in Gmail. */
const DetectiveLogo = ({ className }: DetectiveLogoProps) => (
  <svg viewBox="0 0 512 512" aria-hidden="true" className={className} fill="currentColor">
    <path d="M111 246C128 237 151 228 177 221L203 116C208 94 225 79 246 79C258 79 268 84 278 92C288 84 299 79 312 79C334 79 351 94 357 116L383 221C409 228 432 237 449 246C460 252 457 268 444 268H116C103 268 100 252 111 246Z" />
    <path
      fillRule="evenodd"
      d="M192 285C148 285 116 318 116 360C116 402 148 435 192 435C232 435 260 408 266 373H290C296 408 324 435 364 435C408 435 440 402 440 360C440 318 408 285 364 285C329 285 303 304 292 332H264C253 304 227 285 192 285ZM192 327C212 327 226 341 226 360C226 379 212 393 192 393C172 393 158 379 158 360C158 341 172 327 192 327ZM364 327C384 327 398 341 398 360C398 379 384 393 364 393C344 393 330 379 330 360C330 341 344 327 364 327Z"
    />
  </svg>
);

export default DetectiveLogo;
