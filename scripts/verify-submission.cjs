/* Signed submission envelope: the Issue body can be edited by Triage members,
 * so the review domain must be authenticated independently of editable labels/text.
 * The Worker signs the canonical v3 payload with the existing GitHub App key.
 */
'use strict';
const {createPublicKey,verify}=require('node:crypto');
const PREFIX='HKUST-ELPA:submission:v3:';
const MARKER=/^<!-- elpa-submission-v3:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+) -->\s*$/gm;
function decode(issue,privatePem=process.env.ELPA_APP_PRIVATE_KEY){
  if(!privatePem)throw Error('Review signature key is not configured');
  const matches=[...String(issue.body||'').matchAll(MARKER)];
  if(matches.length!==1)throw Error('Exactly one signed v3 submission marker is required');
  const [,encoded,signature]=matches[0];
  const payload=Buffer.from(encoded,'base64url');
  if(payload.toString('base64url')!==encoded)throw Error('Noncanonical submission encoding');
  if(!verify('sha256',Buffer.from(PREFIX+encoded),createPublicKey(privatePem.replace(/\\n/g,'\n')),
      Buffer.from(signature,'base64url')))throw Error('Submission signature invalid');
  const data=JSON.parse(payload.toString('utf8'));
  if(data.version!==3||data.kind!=='question')throw Error('Unexpected submission schema');
  return data;
}
module.exports={decode,PREFIX};
