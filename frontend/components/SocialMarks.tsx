export function TelegramMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path
        fill="#fff"
        d="M5.5 11.7 17.2 7.2c.54-.2.98.13.8.94l-2 9.2c-.14.64-.54.8-1.1.5l-3-2.2-1.45 1.4c-.17.17-.32.32-.65.32l.23-3.2 6.05-5.46c.26-.23.06-.36-.17-.14L8.4 13.5l-2.9-.9c-.62-.2-.63-.62.0-.9z"
      />
    </svg>
  );
}

export function YouTubeMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="#FF0000"
        d="M23.5 6.2a3.05 3.05 0 0 0-2.15-2.16C19.4 3.6 12 3.6 12 3.6s-7.4 0-9.35.44A3.05 3.05 0 0 0 .5 6.2 32 32 0 0 0 0 12a32 32 0 0 0 .5 5.8 3.05 3.05 0 0 0 2.15 2.16C4.6 20.4 12 20.4 12 20.4s7.4 0 9.35-.44A3.05 3.05 0 0 0 23.5 17.8 32 32 0 0 0 24 12a32 32 0 0 0-.5-5.8z"
      />
      <path fill="#fff" d="M9.75 15.5V8.5L16.2 12z" />
    </svg>
  );
}
