import fs from 'node:fs/promises';
// Publish only the browser application, never repository files or credentials.
await fs.mkdir('public',{recursive:true});
await fs.writeFile('public/index.html',await fs.readFile('Index.html'));
await fs.writeFile('public/_headers',`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'
`);
console.log('Built public/index.html and security headers.');
