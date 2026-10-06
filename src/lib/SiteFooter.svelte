<footer class="site-footer">
  <a class="credit" href="https://teacher.dev" target="_blank" rel="noopener noreferrer">
    <img src="/edtechathon-logo.svg" alt="" width="24" height="24" />
    Built by teacher.dev
  </a>
  <a href="/guides">guides</a>
  <a href="/about">about</a>
  <a href="/privacy">privacy</a>
</footer>

<style>
  .site-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 18px;
    padding: 18px 20px 24px;
  }

  a {
    color: var(--muted);
    font-size: 13px;
    text-decoration: none;
  }

  .credit {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  a:hover {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
</style>
