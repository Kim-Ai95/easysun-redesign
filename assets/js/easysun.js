/* ==========================================================================
   EasySun — behaviour
   Progressive enhancement only. Every page works with JavaScript disabled.
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------
     Configuration

     endpoint — set to a form-handling URL (serverless function, form
     service) to POST enquiries directly. While it is empty the form hands
     the completed enquiry to the visitor's mail client instead, so the
     page never silently swallows a submission.

     contactEmail — CONFIRM WITH EASYSUN before launch.
     -------------------------------------------------------------------- */
  var CONFIG = {
    endpoint: '',
    contactEmail: 'post@easysun.co'
  };

  document.documentElement.classList.add('js');

  /* --------------------------------------------------------------------
     Sticky header — hairline appears once the page has moved
     -------------------------------------------------------------------- */
  var header = document.querySelector('[data-header]');

  if (header) {
    var setScrolled = function () {
      header.setAttribute('data-scrolled', window.scrollY > 8 ? 'true' : 'false');
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });
  }

  /* --------------------------------------------------------------------
     Mobile navigation drawer
     -------------------------------------------------------------------- */
  var toggle = document.querySelector('[data-nav-toggle]');
  var drawer = document.querySelector('[data-drawer]');

  if (toggle && drawer) {
    var main = document.querySelector('main');
    var footer = document.querySelector('footer');

    var setDrawer = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Lukk meny' : 'Åpne meny');
      drawer.hidden = !open;
      document.body.setAttribute('data-drawer-open', String(open));

      // Sealing the rest of the page keeps focus and screen readers inside
      // the drawer without a hand-rolled trap.
      [main, footer].forEach(function (region) {
        if (!region) return;
        if (open) {
          region.setAttribute('inert', '');
        } else {
          region.removeAttribute('inert');
        }
      });

      if (open) {
        var firstLink = drawer.querySelector('a, button');
        if (firstLink) firstLink.focus();
      }
    };

    setDrawer(false);

    toggle.addEventListener('click', function () {
      setDrawer(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setDrawer(false);
        toggle.focus();
      }
    });

    // Anchor links inside the drawer must close it before scrolling.
    drawer.addEventListener('click', function (event) {
      if (event.target.closest('a')) setDrawer(false);
    });

    var desktop = window.matchMedia('(min-width: 64rem)');
    var onBreakpoint = function (event) {
      if (event.matches) setDrawer(false);
    };
    if (desktop.addEventListener) {
      desktop.addEventListener('change', onBreakpoint);
    } else {
      desktop.addListener(onBreakpoint);
    }
  }

  /* --------------------------------------------------------------------
     Reveal on enter — opacity and a short rise, desktop only
     -------------------------------------------------------------------- */
  var revealTargets = document.querySelectorAll('[data-reveal]');

  if (revealTargets.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    revealTargets.forEach(function (target) {
      observer.observe(target);
    });
  } else {
    revealTargets.forEach(function (target) {
      target.classList.add('is-visible');
    });
  }

  /* --------------------------------------------------------------------
     Enquiry form
     -------------------------------------------------------------------- */
  var form = document.querySelector('[data-enquiry-form]');
  if (!form) return;

  var status = form.querySelector('[data-form-status]');
  var submitButton = form.querySelector('[type="submit"]');

  var MESSAGES = {
    segment: 'Velg hvilken type område stasjonene skal stå i.',
    place: 'Fyll inn sted eller kommune.',
    email: 'Fyll inn en gyldig e-postadresse.',
    consent: 'Du må godta personvernerklæringen for å sende inn.',
    generic: 'Feltet må fylles ut.'
  };

  /* Preselect the segment when arriving from a segment row: ?segment=strender */
  var requestedSegment = new URLSearchParams(window.location.search).get('segment');
  var segmentField = form.querySelector('#segment');

  if (requestedSegment && segmentField) {
    var match = Array.prototype.find.call(segmentField.options, function (option) {
      return option.value === requestedSegment;
    });
    if (match) segmentField.value = match.value;
  }

  var fieldWrapper = function (control) {
    return control.closest('.field') || control.closest('.checkbox');
  };

  var showError = function (control, message) {
    var wrapper = fieldWrapper(control);
    if (!wrapper) return;
    var slot = wrapper.querySelector('[data-error-for="' + control.id + '"]');
    wrapper.setAttribute('data-invalid', 'true');
    control.setAttribute('aria-invalid', 'true');
    if (slot) slot.textContent = message;
  };

  var clearError = function (control) {
    var wrapper = fieldWrapper(control);
    if (!wrapper) return;
    var slot = wrapper.querySelector('[data-error-for="' + control.id + '"]');
    wrapper.removeAttribute('data-invalid');
    control.removeAttribute('aria-invalid');
    if (slot) slot.textContent = '';
  };

  var validateControl = function (control) {
    var value = (control.value || '').trim();

    if (control.type === 'checkbox') {
      if (control.required && !control.checked) return MESSAGES.consent;
      return '';
    }
    if (control.required && !value) {
      return MESSAGES[control.name] || MESSAGES.generic;
    }
    if (control.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      return MESSAGES.email;
    }
    return '';
  };

  var controls = Array.prototype.slice.call(
    form.querySelectorAll('input, select, textarea')
  );

  // Validate on blur, then live-correct once a field is already marked wrong.
  controls.forEach(function (control) {
    control.addEventListener('blur', function () {
      var message = validateControl(control);
      if (message) {
        showError(control, message);
      } else {
        clearError(control);
      }
    });

    control.addEventListener('input', function () {
      if (control.getAttribute('aria-invalid') === 'true' && !validateControl(control)) {
        clearError(control);
      }
    });

    if (control.type === 'checkbox') {
      control.addEventListener('change', function () {
        if (!validateControl(control)) clearError(control);
      });
    }
  });

  var buildMailto = function (data) {
    var lines = [
      'Segment: ' + (data.get('segment') || '—'),
      'Antall stasjoner: ' + (data.get('stations') || '—'),
      'Sted / kommune: ' + (data.get('place') || '—'),
      'E-post: ' + (data.get('email') || '—'),
      '',
      'Melding:',
      data.get('message') || '(ingen melding)'
    ];
    return (
      'mailto:' +
      CONFIG.contactEmail +
      '?subject=' +
      encodeURIComponent('Henvendelse fra easysun.co — ' + (data.get('place') || 'nytt sted')) +
      '&body=' +
      encodeURIComponent(lines.join('\n'))
    );
  };

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var firstInvalid = null;
    controls.forEach(function (control) {
      var message = validateControl(control);
      if (message) {
        showError(control, message);
        if (!firstInvalid) firstInvalid = control;
      } else {
        clearError(control);
      }
    });

    if (firstInvalid) {
      status.textContent = 'Skjemaet mangler noen opplysninger. Se feltene merket nedenfor.';
      firstInvalid.focus();
      return;
    }

    var data = new FormData(form);

    if (!CONFIG.endpoint) {
      status.textContent =
        'Åpner e-postprogrammet ditt med henvendelsen ferdig utfylt. Send e-posten for å fullføre.';
      window.location.href = buildMailto(data);
      return;
    }

    submitButton.classList.add('btn--loading');
    submitButton.disabled = true;
    status.textContent = 'Sender henvendelsen …';

    fetch(CONFIG.endpoint, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed: ' + response.status);
        form.reset();
        status.textContent =
          'Takk — henvendelsen er sendt. Vi tar kontakt med forslag til neste steg.';
      })
      .catch(function () {
        status.textContent =
          'Innsendingen gikk ikke gjennom. Prøv igjen, eller send oss en e-post på ' +
          CONFIG.contactEmail + '.';
      })
      .finally(function () {
        submitButton.classList.remove('btn--loading');
        submitButton.disabled = false;
      });
  });
})();
