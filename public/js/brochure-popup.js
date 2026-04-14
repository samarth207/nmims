/* ===== Brochure Download Popup ===== */
(function () {
    'use strict';

    var BROCHURE_PATH = '/documents/NMIMS-Brochure.pdf';

    // Create popup HTML
    function createBrochurePopup() {
        var overlay = document.createElement('div');
        overlay.className = 'brochure-overlay';
        overlay.id = 'brochureOverlay';
        overlay.innerHTML =
            '<div class="brochure-popup">' +
                '<button class="brochure-close" id="brochureClose" aria-label="Close">&times;</button>' +
                '<div class="brochure-popup-header">' +
                    '<h3>📄 Download Brochure</h3>' +
                    '<p>Enter your details to download the NMIMS programme brochure</p>' +
                '</div>' +
                '<div class="brochure-form-card">' +
                    '<form id="brochureForm">' +
                        '<input type="text" name="name" placeholder="Full Name *" required>' +
                        '<input type="email" name="email" placeholder="Email Address *" required>' +
                        '<div class="phone-input-wrapper"><select class="country-code"><option value="+91" selected>+91 India</option><option value="+1">+1 USA/Canada</option><option value="+44">+44 UK</option><option value="+971">+971 UAE</option><option value="+61">+61 Australia</option><option value="+65">+65 Singapore</option><option value="+49">+49 Germany</option><option value="+33">+33 France</option><option value="+81">+81 Japan</option><option value="+86">+86 China</option><option value="+966">+966 Saudi Arabia</option><option value="+974">+974 Qatar</option><option value="+973">+973 Bahrain</option><option value="+965">+965 Kuwait</option><option value="+968">+968 Oman</option><option value="+92">+92 Pakistan</option><option value="+977">+977 Nepal</option><option value="+880">+880 Bangladesh</option><option value="+94">+94 Sri Lanka</option><option value="+64">+64 New Zealand</option><option value="+27">+27 South Africa</option><option value="+55">+55 Brazil</option><option value="+60">+60 Malaysia</option><option value="+66">+66 Thailand</option><option value="+31">+31 Netherlands</option><option value="+41">+41 Switzerland</option><option value="+46">+46 Sweden</option><option value="+47">+47 Norway</option><option value="+45">+45 Denmark</option><option value="+39">+39 Italy</option></select><input type="tel" name="phone" placeholder="Mobile Number *" maxlength="15" required></div>' +
                        '<button type="submit" class="brochure-submit-btn">DOWNLOAD BROCHURE</button>' +
                    '</form>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        return overlay;
    }

    // Open popup
    function openBrochurePopup() {
        var overlay = document.getElementById('brochureOverlay') || createBrochurePopup();
        
        // Reset form if previously submitted
        var formCard = overlay.querySelector('.brochure-form-card');
        if (!overlay.querySelector('#brochureForm')) {
            formCard.innerHTML =
                '<form id="brochureForm">' +
                    '<input type="text" name="name" placeholder="Full Name *" required>' +
                    '<input type="email" name="email" placeholder="Email Address *" required>' +
                    '<div class="phone-input-wrapper"><select class="country-code"><option value="+91" selected>+91 India</option><option value="+1">+1 USA/Canada</option><option value="+44">+44 UK</option><option value="+971">+971 UAE</option><option value="+61">+61 Australia</option><option value="+65">+65 Singapore</option><option value="+49">+49 Germany</option><option value="+33">+33 France</option><option value="+81">+81 Japan</option><option value="+86">+86 China</option><option value="+966">+966 Saudi Arabia</option><option value="+974">+974 Qatar</option><option value="+973">+973 Bahrain</option><option value="+965">+965 Kuwait</option><option value="+968">+968 Oman</option><option value="+92">+92 Pakistan</option><option value="+977">+977 Nepal</option><option value="+880">+880 Bangladesh</option><option value="+94">+94 Sri Lanka</option><option value="+64">+64 New Zealand</option><option value="+27">+27 South Africa</option><option value="+55">+55 Brazil</option><option value="+60">+60 Malaysia</option><option value="+66">+66 Thailand</option><option value="+31">+31 Netherlands</option><option value="+41">+41 Switzerland</option><option value="+46">+46 Sweden</option><option value="+47">+47 Norway</option><option value="+45">+45 Denmark</option><option value="+39">+39 Italy</option></select><input type="tel" name="phone" placeholder="Mobile Number *" maxlength="15" required></div>' +
                    '<button type="submit" class="brochure-submit-btn">DOWNLOAD BROCHURE</button>' +
                '</form>';
        }

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        bindFormEvents(overlay);
    }

    // Bind events
    function bindFormEvents(overlay) {
        var closeBtn = overlay.querySelector('#brochureClose');
        var form = overlay.querySelector('#brochureForm');

        // Close button
        closeBtn.onclick = closeBrochurePopup;

        // Overlay click
        overlay.onclick = function (e) {
            if (e.target === overlay) closeBrochurePopup();
        };

        // Escape key
        document.addEventListener('keydown', handleEscape);

        // Form submit
        if (form && !form.dataset.bound) {
            form.dataset.bound = 'true';
            form.addEventListener('submit', function (e) {
                e.preventDefault();

                var nameInput = form.querySelector('input[name="name"]');
                var emailInput = form.querySelector('input[name="email"]');
                var phoneInput = form.querySelector('input[name="phone"]');

                var nameParts = (nameInput.value || '').trim().split(' ');
                var data = {
                    form_type: 'brochure',
                    first_name: nameParts[0] || '',
                    last_name: nameParts.slice(1).join(' ') || '',
                    email: emailInput.value.trim(),
                    phone: phoneInput.value.trim(),
                    page_url: window.location.href,
                    consent: true
                };

                var btn = form.querySelector('.brochure-submit-btn');
                btn.textContent = 'Submitting...';
                btn.disabled = true;

                // Submit to API
                fetch('/api/submit-form', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(function () { showThankYouAndDownload(overlay); })
                .catch(function () { showThankYouAndDownload(overlay); }); // Graceful: still download
            });
        }
    }

    // Show thank you + trigger download
    function showThankYouAndDownload(overlay) {
        var formCard = overlay.querySelector('.brochure-form-card');
        formCard.innerHTML =
            '<div class="brochure-thank-you">' +
                '<div class="check-icon">✅</div>' +
                '<h3>Thank You!</h3>' +
                '<p>Your brochure is downloading now...</p>' +
                '<p class="download-note">If download doesn\'t start, <a href="' + BROCHURE_PATH + '" download style="color:#6C4DE6;text-decoration:underline;">click here</a></p>' +
            '</div>';

        // Trigger PDF download
        triggerDownload();

        // Auto-close after 3s
        setTimeout(closeBrochurePopup, 3500);
    }

    // Download PDF
    function triggerDownload() {
        var link = document.createElement('a');
        link.href = BROCHURE_PATH;
        link.download = 'NMIMS-Brochure.pdf';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () { link.remove(); }, 1000);
    }

    // Close popup
    function closeBrochurePopup() {
        var overlay = document.getElementById('brochureOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        document.removeEventListener('keydown', handleEscape);
    }

    function handleEscape(e) {
        if (e.key === 'Escape') closeBrochurePopup();
    }

    // ===== Attach to all Download Brochure buttons =====
    function init() {
        var buttons = document.querySelectorAll('.btn-download-brochure');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                openBrochurePopup();
            });
        });
    }

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
