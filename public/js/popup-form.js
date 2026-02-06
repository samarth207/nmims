/* ===== Auto Popup Form - 6 Second Delay ===== */
(function () {
    // Only show once per session
    if (sessionStorage.getItem('popupShown')) return;

    // Build the popup HTML
    function createPopupHTML() {
        return `
        <div class="popup-overlay" id="autoPopupOverlay">
            <div class="popup-container">
                <button class="popup-close" id="popupClose" aria-label="Close">&times;</button>
                <div class="popup-left">
                    <div class="popup-logo">
                        <img src="${getImagePath()}images/formbanner/NMIMS-CDOE-bg.png" alt="NMIMS CDOE">
                    </div>
                    <h2>Take the <span>First Step</span> Towards Your Future</h2>
                    <p>Speak with our expert counsellors and find the perfect programme for your career goals.</p>
                    <ul class="popup-highlights">
                        <li>Free personalised counselling session</li>
                        <li>UGC-entitled online degrees</li>
                        <li>Flexible learning for working professionals</li>
                        <li>NAAC A+ accredited university</li>
                    </ul>
                </div>
                <div class="popup-right">
                    <div class="popup-form-card">
                        <h3>Request a Callback</h3>
                        <p class="form-sub">Fill in your details and we'll get back to you shortly</p>
                        <form id="popupEnquiryForm">
                            <div class="popup-form-row">
                                <input type="text" placeholder="First Name *" required>
                                <input type="text" placeholder="Last Name *" required>
                            </div>
                            <input type="email" placeholder="Email Address *" required>
                            <input type="tel" placeholder="Mobile Number *" maxlength="10" required>
                            <select required>
                                <option value="" disabled selected>I'm Interested In *</option>
                                <option>MBA Online</option>
                                <option>MBA WX</option>
                                <option>Bachelors Programs</option>
                                <option>Certificate Programs</option>
                                <option>Diploma Programs</option>
                            </select>
                            <select required>
                                <option value="" disabled selected>Enquiry Type *</option>
                                <option>Admission Enquiry</option>
                                <option>Counselling Session</option>
                                <option>Programme Information</option>
                                <option>Fee Structure</option>
                                <option>Other</option>
                            </select>
                            <label class="popup-checkbox-label">
                                <input type="checkbox" required>
                                <span>I authorise NMIMS CDOE to contact me via phone/email. This overrides DND/NDNC registry.</span>
                            </label>
                            <button type="submit" class="popup-submit-btn">GET FREE COUNSELLING</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // Determine relative image path based on page depth
    function getImagePath() {
        var path = window.location.pathname;
        // Pages in /programs/ or /blog/ subfolders need ../
        if (path.includes('/programs/') || path.includes('/blog/')) {
            return '../';
        }
        return '';
    }

    // Inject popup after 6 seconds
    setTimeout(function () {
        // Don't show if already exists (safety check)
        if (document.getElementById('autoPopupOverlay')) return;

        // Insert popup HTML into body
        var wrapper = document.createElement('div');
        wrapper.innerHTML = createPopupHTML();
        document.body.appendChild(wrapper.firstElementChild);

        // Small delay for DOM render, then activate
        requestAnimationFrame(function () {
            var overlay = document.getElementById('autoPopupOverlay');
            if (overlay) {
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });

        // Mark as shown for this session
        sessionStorage.setItem('popupShown', 'true');

        // Close handlers
        setupCloseHandlers();
    }, 6000);

    function setupCloseHandlers() {
        var overlay = document.getElementById('autoPopupOverlay');
        var closeBtn = document.getElementById('popupClose');

        if (closeBtn) {
            closeBtn.addEventListener('click', closePopup);
        }

        // Close on overlay click (not on popup itself)
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    closePopup();
                }
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closePopup();
            }
        });

        // Handle form submission
        var form = document.getElementById('popupEnquiryForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                // Show a quick thank-you state
                var card = form.closest('.popup-form-card');
                if (card) {
                    card.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:48px;margin-bottom:16px;">✅</div><h3 style="font-size:20px;color:#333;margin-bottom:8px;">Thank You!</h3><p style="font-size:14px;color:#666;">Our counsellor will contact you shortly.</p></div>';
                }
                setTimeout(closePopup, 2500);
            });
        }
    }

    function closePopup() {
        var overlay = document.getElementById('autoPopupOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease';
            document.body.style.overflow = '';
            setTimeout(function () {
                overlay.remove();
            }, 300);
        }
    }
})();
