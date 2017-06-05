// export const navigate = route => {
//   document.body.setAttribute('route', route)
//   location.hash = route
// }

export const onRouteChange = fn => window.addEventListener('hashchange', (e) => {
  fn(e.newURL.replace(/^.*#(.*?)$/, '$1'), e.oldURL.replace(/^.*#(.*?)$/, '$1'))
}, false)

export const setUserName = name => document.querySelector('.user__name').innerHTML = name

// export const onAuthStateChanged = (user) => {
//   if (!user) {
//     navigate('guest')
//   } else {
//     setUserName(user.displayName)
//     navigate('account')
//   }
// }