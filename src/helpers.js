export const navigate = route => {
  document.body.setAttribute('route', route)
  location.hash = route
}

export const setUserName = name => document.querySelector('.user__name').innerHTML = name

export const onAuthStateChanged = (user) => {
  if (!user) {
    navigate('guest')
  } else {
    setUserName(user.displayName)
    navigate('account')
  }
}