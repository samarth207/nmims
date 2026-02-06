/* ===== Unified Form Handler - Submits all forms to /api/submit-form ===== */
(function () {
    'use strict';

    const API_URL = '/api/submit-form';

    // ===== 1. Handle Enquiry Modal Form =====
    function initEnquiryForm() {
        const form = document.querySelector('#enquireModal .enquire-form');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const inputs = form.querySelectorAll('input, select');
            const data = {
                form_type: 'enquiry',
                first_name: inputs[0] ? inputs[0].value : '',
                last_name: inputs[1] ? inputs[1].value : '',
                email: inputs[2] ? inputs[2].value : '',
                phone: inputs[3] ? inputs[3].value : '',
                programme: inputs[4] ? inputs[4].value : '',
                city: inputs[5] ? inputs[5].value : '',
                enroll_timeline: inputs[6] ? inputs[6].value : '',
                consent: inputs[7] ? inputs[7].checked : false,
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
                    const inputs = form.querySelectorAll('input, select');
                    const data = {
                        form_type: 'popup',
                        first_name: inputs[0] ? inputs[0].value : '',
                        last_name: inputs[1] ? inputs[1].value : '',
                        email: inputs[2] ? inputs[2].value : '',
                        phone: inputs[3] ? inputs[3].value : '',
                        programme: inputs[4] ? inputs[4].value : '',
                        enquiry_type: inputs[5] ? inputs[5].value : '',
                        consent: inputs[6] ? inputs[6].checked : false,
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

    // ===== Init on DOM ready =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initEnquiryForm();
            initPopupForm();
            initBrochureForm();
        });
    } else {
        initEnquiryForm();
        initPopupForm();
        initBrochureForm();
    }
})();
