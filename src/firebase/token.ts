import { encodeUrl, createJWT, getNumericDateJWT } from '../deps.ts'
import type { ServiceAccountKey, GoogleAuthToken } from './types.ts'

export async function createSignedJwt(key: ServiceAccountKey): Promise<string> {
  const iat = getNumericDateJWT(new Date())

  const jwt = await createJWT(
    {
      alg: 'RS256',
      typ: 'JWT',
    },
    {
      iss: key.client_email,
      aud: key.token_uri,
      scope: [
        'https://www.googleapis.com/auth/datastore',
        'https://www.googleapis.com/auth/firebase',
        'https://www.googleapis.com/auth/firebase.database',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      iat,
      exp: iat + 60 * 60,
    },
    key.private_key
  )

  return jwt
}

export async function getAuthToken(jwt: string, key: ServiceAccountKey): Promise<GoogleAuthToken> {
  const rawBody = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeUrl(rawBody),
  })
  const data = await res.json()

  return data
}

export async function getToken(key: ServiceAccountKey): Promise<string> {
  const jwt = await createSignedJwt(key)
  return (await getAuthToken(jwt, key)).access_token
}
