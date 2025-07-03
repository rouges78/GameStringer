document.addEventListener('DOMContentLoaded', function() {

    // Smooth scrolling per i link di navigazione
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70, // Offset per l'header fisso
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animazione degli elementi allo scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    const elementsToAnimate = document.querySelectorAll('.feature-card, .vision-text, .tech-item, #contact-form');
    elementsToAnimate.forEach(el => {
        el.classList.add('hidden-initial');
        observer.observe(el);
    });

    // Gestione del form di contatto
    const contactForm = document.getElementById('contact-form');
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Grazie per il tuo interesse! La tua richiesta è stata inviata. Ti contatteremo al più presto.');
        this.reset();
    });

});

// Aggiungiamo un po' di CSS per le animazioni
const style = document.createElement('style');
style.innerHTML = `
    .hidden-initial {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    .visible {
        opacity: 1;
        transform: translateY(0);
    }
`;
document.head.appendChild(style);
