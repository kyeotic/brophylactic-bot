import { initContext } from '../src/di.js'

initContext()
  .firebaseClient.getToken()
  .then((t) => console.log(t))
