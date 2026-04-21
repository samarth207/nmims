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
                            <div class="phone-input-wrapper"><select class="country-code"><option value="+91" selected>+91 India</option><option value="+1">+1 USA/Canada</option><option value="+44">+44 UK</option><option value="+971">+971 UAE</option><option value="+61">+61 Australia</option><option value="+65">+65 Singapore</option><option value="+49">+49 Germany</option><option value="+33">+33 France</option><option value="+81">+81 Japan</option><option value="+86">+86 China</option><option value="+966">+966 Saudi Arabia</option><option value="+974">+974 Qatar</option><option value="+973">+973 Bahrain</option><option value="+965">+965 Kuwait</option><option value="+968">+968 Oman</option><option value="+92">+92 Pakistan</option><option value="+977">+977 Nepal</option><option value="+880">+880 Bangladesh</option><option value="+94">+94 Sri Lanka</option><option value="+64">+64 New Zealand</option><option value="+27">+27 South Africa</option><option value="+55">+55 Brazil</option><option value="+60">+60 Malaysia</option><option value="+66">+66 Thailand</option><option value="+31">+31 Netherlands</option><option value="+41">+41 Switzerland</option><option value="+46">+46 Sweden</option><option value="+47">+47 Norway</option><option value="+45">+45 Denmark</option><option value="+39">+39 Italy</option></select><input type="tel" placeholder="Mobile Number *" maxlength="15" required></div>
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
