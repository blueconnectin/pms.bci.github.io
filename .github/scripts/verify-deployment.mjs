// Read-only readiness checks. Never send credentials, upload files, or log tokens.
export async function verifyRelease(base,commit,fetcher=fetch) {
  const query='?release='+encodeURIComponent(commit)+'&check='+Date.now();
  const versionResponse=await fetcher(base+'/version.json'+query,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!versionResponse.ok)throw new Error('Domain version endpoint returned HTTP '+versionResponse.status+'. Check Custom Domain routing and the deployed Worker.');
  let version;
  try {version=await versionResponse.json();}catch {throw new Error('Domain version response is not JSON.');}
  if(version.commit!==commit)throw new Error('Domain is not serving this workflow commit yet. Check competing Cloudflare builds or routing.');
  const response=await fetcher(base+'/api/config'+query,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  let config;
  try {config=await response.json();}catch {throw new Error('Drive configuration response is not JSON (HTTP '+response.status+').');}
  if(!response.ok)throw new Error('Drive configuration failed (HTTP '+response.status+'): '+String(config.error || config.code || 'unknown error').slice(0,250));
  if(config.enabled!==true)throw new Error('Drive upload is not enabled. Run authorizeEvidenceStorage as the Apps Script deployment owner.');
}
if(process.argv[1] && new URL(import.meta.url).pathname===process.argv[1]) {
  const commit=process.env.GITHUB_SHA;
  if(!commit){console.error('GITHUB_SHA is required.');process.exitCode=1;}
  else {
    for(let attempt=1;attempt<=3;attempt++) {
      try {await verifyRelease('https://payment.blueconnect.id',commit);console.log('PASS: custom domain serves the expected commit and Drive upload is enabled.');break;}
      catch(error){console.error('Readiness check '+attempt+': '+error.message);if(attempt===3)process.exitCode=1;else await new Promise(resolve=>setTimeout(resolve,5000));}
    }
  }
}
