import jwtSimple from 'jwt-simple'
import encodeUrl from 'encodeurl'
import request from 'request-micro'
import type { ServiceAccountKey, GoogleAuthToken } from './types.js'

const { encode: createJWT } = jwtSimple

export async function createSignedJwt(key: ServiceAccountKey): Promise<string> {
  const iat = getNumericDate(new Date())

  const payload = {
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
  }

  return createJWT(payload, key.private_key, 'RS256')
}

export async function getAuthToken(jwt: string, key: ServiceAccountKey): Promise<GoogleAuthToken> {
  const rawBody = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  const res = await request({
    url: key.token_uri,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: encodeUrl(rawBody),
  })
  const data = JSON.parse(res.data)

  return data
}

export async function getToken(key: ServiceAccountKey): Promise<string> {
  const jwt = await createSignedJwt(key)
  return (await getAuthToken(jwt, key)).access_token
}

export function getNumericDate(exp: number | Date): number {
  return Math.round((exp instanceof Date ? exp.getTime() : Date.now() + exp * 1000) / 1000)
}
