/**
 * Sidebar Accordion and Program Filter Functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Accordion Toggle
    const accordionHeaders = document.querySelectorAll('.sidebar-accordion-header');
    
    accordionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const accordion = this.parentElement;
            accordion.classList.toggle('open');
        });
    });
    
    // Filter Functionality
    const allProgramCards = document.querySelectorAll('.program-listing-card');
    const filterLinks = document.querySelectorAll('.sidebar-sub-link, .sidebar-link[data-filter]');
    
    filterLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const filterValue = this.getAttribute('data-filter');
            
            // Remove active class from all links
            filterLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Filter cards
            allProgramCards.forEach(card => {
                if (filterValue === 'all') {
                    card.classList.remove('hidden');
                } else if (filterValue.startsWith('duration-')) {
                    const durationValue = filterValue.replace('duration-', '');
                    const cardDuration = card.getAttribute('data-duration');
                    
                    if (cardDuration === durationValue) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                } else {
                    const cardCertification = card.getAttribute('data-certification');
                    
                    if (cardCertification === filterValue) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                }
            });
        });
    });
});
