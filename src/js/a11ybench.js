window.addEventListener('DOMContentLoaded', () => {
  // Run tabs JS if there are any tabs on the page
  if (document.querySelector('[role="tab"]')) {
      const tabs = document.querySelectorAll('[role="tab"]')
      const tabList = document.querySelector('[role="tablist"]')

      // Add a click event handler to each tab
      tabs.forEach((tab) => {
        tab.addEventListener('click', changeTabs)
      })

      // Enable arrow navigation between tabs in the tab list
      let tabFocus = 0

      tabList.addEventListener('keydown', (e) => {
        // Move right
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          tabs[tabFocus].setAttribute('tabindex', -1)
          if (e.key === 'ArrowRight') {
            tabFocus++
            // If we're at the end, go to the start
            if (tabFocus >= tabs.length) {
              tabFocus = 0
            }
            // Move left
          } else if (e.key === 'ArrowLeft') {
            tabFocus--
            // If we're at the start, move to the end
            if (tabFocus < 0) {
              tabFocus = tabs.length - 1
            }
          }

          tabs[tabFocus].setAttribute('tabindex', 0)
          tabs[tabFocus].focus()
        }
      })
    }

    function changeTabs(e) {
      const target = e.target
      const parent = target.parentNode
      const grandparent = parent.parentNode

      // Remove all current selected tabs
      parent
        .querySelectorAll('[aria-selected="true"]')
        .forEach((t) => t.setAttribute('aria-selected', false))

      // Set this tab as selected
      target.setAttribute('aria-selected', true)

      // Hide all tab panels
      grandparent
        .querySelectorAll('[role="tabpanel"]')
        .forEach((p) => p.setAttribute('hidden', true))

      // Show the selected panel
      grandparent.parentNode
        .querySelector(`#${target.getAttribute('aria-controls')}`)
        .removeAttribute('hidden')
  }

  // After the page is loaded, add tabindex="0" to all <code> elements

  document.querySelectorAll('code').forEach((code) => {
    code.setAttribute('tabindex', 0)
  })

  // If a <pre> tag contains a <code> tag, remove the tabindex attribute from the <pre> tag
  document.querySelectorAll('pre code').forEach((code) => {
    code.parentNode.removeAttribute('tabindex')
  })

  // If the current page isn't currently located on the domain "clearcut.steedgood.com,"
  // then remove the base href with the subfolder
  if (window.location.hostname !== 'clearcut.steedgood.com') {
    console.log("Visiting from not clearcut.steedgood.com domain")
    // remove <base> element
    document.querySelector('base').remove()
  }

})
