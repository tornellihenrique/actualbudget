function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type LoginPageProps = {
  requestId: string;
  clientName: string;
  redirectHost: string;
  error?: string;
};

export function renderLoginPage({
  requestId,
  clientName,
  redirectHost,
  error,
}: LoginPageProps) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to Actual</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 0 16px; background: Canvas; color: CanvasText; }
  main { width: 100%; max-width: 360px; }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  p { margin: 0 0 16px; opacity: .8; line-height: 1.4; }
  input, button { width: 100%; box-sizing: border-box; font: inherit; padding: 10px 12px; border-radius: 8px; }
  input { border: 1px solid GrayText; margin-bottom: 12px; }
  button { border: 0; background: #8719e0; color: white; cursor: pointer; }
  .error { color: #d32f2f; opacity: 1; }
</style>
</head>
<body>
<main>
  <h1>Connect ${escapeHtml(clientName)} to Actual</h1>
  <p>It will be able to read and change this budget. You will be returned to <strong>${escapeHtml(redirectHost)}</strong>.</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
  <form method="post" action="/authorize/login">
    <input type="hidden" name="request_id" value="${escapeHtml(requestId)}">
    <input type="password" name="password" placeholder="Actual server password" autocomplete="current-password" required autofocus>
    <button type="submit">Allow access</button>
  </form>
</main>
</body>
</html>`;
}
