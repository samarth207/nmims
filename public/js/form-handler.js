/* ===== Unified Form Handler - Submits all forms to /api/submit-form ===== */
(function () {
    'use strict';

    const API_URL = '/api/submit-form';

    // ===== Helper: extract phone number and country code separately =====
    function getPhoneData(form) {
        var ccSel = form.querySelector('select.country-code');
        var telInput = form.querySelector('input[type="tel"]');
        var cc = ccSel ? ccSel.value : '+91';
        var num = telInput ? telInput.value.trim() : '';
        return { country_code: cc, phone: num };
    }

    // ===== 1. Handle Enquiry Modal Form =====
    function initEnquiryForm() {
        const form = document.querySelector('#enquireModal .enquire-form');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var textInputs = form.querySelectorAll('input[type="text"]');
            var emailInput = form.querySelector('input[type="email"]');
            var otherSelects = form.querySelectorAll('select:not(.country-code)');
            var consent = form.querySelector('input[type="checkbox"]');
            var phoneData = getPhoneData(form);
            const data = {
                form_type: 'enquiry',
                first_name: textInputs[0] ? textInputs[0].value : '',
                last_name: textInputs[1] ? textInputs[1].value : '',
                email: emailInput ? emailInput.value : '',
                country_code: phoneData.country_code,
                phone: phoneData.phone,
                programme: otherSelects[0] ? otherSelects[0].value : '',
                city: otherSelects[1] ? otherSelects[1].value : '',
                enroll_timeline: otherSelects[2] ? otherSelects[2].value : '',
                consent: consent ? consent.checked : false,
                page_url: window.location.href
            };
            submitForm(data, form, 'enquiry');
        });
    }

    // ===== 2. Handle Auto-Popup Form =====
    function initPopupForm() {
        // Use MutationObserver since popup is injected dynamically after 6s
        const observer = new MutationObserver(function (mutations) {
            const form = document.getElementById('popupEnquiryForm');
            if (form && !form.dataset.handlerBound) {
                form.dataset.handlerBound = 'true';
                form.addEventListener('submit', function (e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    var textInputs = form.querySelectorAll('input[type="text"]');
                    var emailInput = form.querySelector('input[type="email"]');
                    var otherSelects = form.querySelectorAll('select:not(.country-code)');
                    var consent = form.querySelector('input[type="checkbox"]');
                    var phoneData = getPhoneData(form);
                    const data = {
                        form_type: 'popup',
                        first_name: textInputs[0] ? textInputs[0].value : '',
                        last_name: textInputs[1] ? textInputs[1].value : '',
                        email: emailInput ? emailInput.value : '',
                        country_code: phoneData.country_code,
                        phone: phoneData.phone,
                        programme: otherSelects[0] ? otherSelects[0].value : '',
                        enquiry_type: otherSelects[1] ? otherSelects[1].value : '',
                        consent: consent ? consent.checked : false,
                        page_url: window.location.href
                    };
                    submitForm(data, form, 'popup');
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ===== 3. Handle Brochure Download Form =====
    function initBrochureForm() {
        // This is handled by brochure-popup.js which calls submitForm via window
        // Expose submitForm globally for brochure popup
        window.__submitFormToAPI = submitForm;
    }

    // ===== 4. Inject contact number into footer Support section =====
    function initFooterContactNumber() {
        var supportHeadings = document.querySelectorAll('.footer-title');
        var supportList = null;
        for (var i = 0; i < supportHeadings.length; i++) {
            if (supportHeadings[i].textContent.trim() === 'Support') {
                supportList = supportHeadings[i].nextElementSibling;
                break;
            }
        }
        if (!supportList) return;
        if (supportList.querySelector('.nmims-phone-entry')) return;
        var li = document.createElement('li');
        li.className = 'nmims-phone-entry';
        li.innerHTML = '<a href="tel:+919311381814" style="display:flex;align-items:center;gap:6px;">📞 +91 93113 81814</a>';
        supportList.insertBefore(li, supportList.firstChild);
    }

    // ===== Submit to API =====
    function submitForm(data, formElement, formType) {
        const btn = formElement.querySelector('button[type="submit"], .popup-submit-btn, .brochure-submit-btn');
        const originalText = btn ? btn.textContent : '';
        if (btn) {
            btn.textContent = 'Submitting...';
            btn.disabled = true;
        }

        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(function (res) { return res.json(); })
        .then(function (result) {
            if (result.success) {
                showThankYou(formElement, formType);
            } else {
                alert(result.message || 'Something went wrong. Please try again.');
                if (btn) { btn.textContent = originalText; btn.disabled = false; }
            }
        })
        .catch(function () {
            // If DB is not connected, still show thank you (graceful degradation)
            showThankYou(formElement, formType);
        });
    }

    // ===== Thank You State =====
    function showThankYou(formElement, formType) {
        var card = formElement.closest('.popup-form-card, .enquire-form, .brochure-form-card');
        if (!card) card = formElement;

        if (formType === 'brochure') {
            // Brochure form handles its own thank you + download
            return;
        }

        card.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
            '<div style="font-size:48px;margin-bottom:16px;">✅</div>' +
            '<h3 style="font-size:20px;color:#333;margin-bottom:8px;">Thank You!</h3>' +
            '<p style="font-size:14px;color:#666;">Our counsellor will contact you shortly.</p>' +
            '</div>';

        if (formType === 'popup') {
            setTimeout(function () {
                var overlay = document.getElementById('autoPopupOverlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.3s ease';
                    document.body.style.overflow = '';
                    setTimeout(function () { overlay.remove(); }, 300);
                }
            }, 2500);
        }

        if (formType === 'enquiry') {
            setTimeout(function () {
                var modal = document.getElementById('enquireModal');
                if (modal) modal.classList.remove('active');
            }, 2500);
        }
    }

    // ===== Sticky WhatsApp & Call Icons =====
    function initStickyContactIcons() {
        if (document.getElementById('nmimsStickyContact')) return;
        var el = document.createElement('div');
        el.id = 'nmimsStickyContact';
        el.style.cssText = 'position:fixed;bottom:24px;right:20px;z-index:9998;display:flex;flex-direction:column;gap:12px;align-items:flex-end;';
        el.innerHTML =
            // WhatsApp button
            '<a href="https://wa.me/919311381814" target="_blank" rel="noopener noreferrer" title="WhatsApp us"' +
            ' style="display:flex;align-items:center;gap:10px;background:#25D366;border-radius:50px;box-shadow:0 4px 14px rgba(37,211,102,0.45);text-decoration:none;padding:0 16px 0 0;height:52px;overflow:hidden;">' +
            '<span style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;flex-shrink:0;">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="#fff" viewBox="0 0 16 16">' +
            '<path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>' +
            '</svg></span>' +
            '<span style="color:#fff;font-size:13px;font-weight:600;white-space:nowrap;font-family:Poppins,sans-serif;">WhatsApp Us</span>' +
            '</a>' +
            // Call button with number
            '<a href="tel:+919311381814" title="Call NMIMS"' +
            ' style="display:flex;align-items:center;gap:10px;background:#6C4DE6;border-radius:50px;box-shadow:0 4px 14px rgba(108,77,230,0.45);text-decoration:none;padding:0 16px 0 0;height:52px;overflow:hidden;">' +
            '<span style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;flex-shrink:0;">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#fff" viewBox="0 0 16 16">' +
            '<path fill-rule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z"/>' +
            '</svg></span>' +
            '<span style="color:#fff;font-size:13px;font-weight:600;white-space:nowrap;font-family:Poppins,sans-serif;">+91 93113 81814</span>' +
            '</a>';
        document.body.appendChild(el);

        // Responsive: hide text labels on mobile
        var style = document.createElement('style');
        style.textContent = '#nmimsStickyContact a span:last-child { display:inline; } @media(max-width:480px){ #nmimsStickyContact a { border-radius:50%; padding:0 !important; width:52px; justify-content:center; } #nmimsStickyContact a span:last-child { display:none; } }';
        document.head.appendChild(style);

        // Hover effects
        var links = el.querySelectorAll('a');
        links.forEach(function(a) {
            a.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.05)';
                this.style.transition = 'transform 0.2s';
            });
            a.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
        });
    }

    // ===== Init on DOM ready =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initEnquiryForm();
            initPopupForm();
            initBrochureForm();
            initFooterContactNumber();
            initStickyContactIcons();
        });
    } else {
        initEnquiryForm();
        initPopupForm();
        initBrochureForm();
        initFooterContactNumber();
        initStickyContactIcons();
    }
})();
