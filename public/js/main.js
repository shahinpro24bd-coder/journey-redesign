(function ($) {
    "use strict";

    // Initiate the wowjs
    new WOW().init();


    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.sticky-top').addClass('shadow-sm').css('top', '0px');
        } else {
            $('.sticky-top').removeClass('shadow-sm').css('top', '-150px');
        }
    });
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 100) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });


    // Header carousel
    $(".header-carousel").owlCarousel({
        items: 1,
        autoplay: true,
        smartSpeed: 1000,
        loop: true,
        dots: false,
        nav : true,
        navText : [
            '<i class="bi bi-arrow-left"></i>',
            '<i class="bi bi-arrow-right"></i>'
        ]
    });


    // Facts counter
    $('[data-toggle="counter-up"]').counterUp({
        delay: 10,
        time: 2000
    });


    // Testimonials carousel
    $(".testimonial-carousel").owlCarousel({
        autoplay: false,
        smartSpeed: 1000,
        margin: 25,
        loop: true,
        center: true,
        dots: false,
        nav: true,
        navText : [
            '<i class="bi bi-chevron-left"></i>',
            '<i class="bi bi-chevron-right"></i>'
        ],
        responsive: {
            0:{
                items:1
            },
            768:{
                items:2
            },
            992:{
                items:3
            }
        }
    });







































        (function() {
        // premium toast notification
        function heroToast(msg, icon = '✨') {
            let toast = document.createElement('div');
            toast.innerHTML = `<span style="margin-right: 12px; font-size: 18px;">${icon}</span>${msg}`;
            toast.style.position = 'fixed';
            toast.style.bottom = '30px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            toast.style.backgroundColor = '#1e1c19';
            toast.style.color = '#fff3e6';
            toast.style.padding = '14px 28px';
            toast.style.borderRadius = '60px';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '500';
            toast.style.fontFamily = "'Inter', system-ui, sans-serif";
            toast.style.boxShadow = '0 20px 35px -8px rgba(0,0,0,0.25), 0 0 0 1px rgba(184,134,11,0.3)';
            toast.style.zIndex = '9999';
            toast.style.backdropFilter = 'blur(12px)';
            toast.style.background = 'rgba(0,0,0,0.85)';
            toast.style.border = '1px solid rgba(184,134,11,0.5)';
            toast.style.maxWidth = '85%';
            toast.style.textAlign = 'center';
            toast.style.letterSpacing = '0.3px';
            toast.style.transition = 'all 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.2)';
            toast.style.opacity = '0';
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            }, 20);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(20px)';
                setTimeout(() => { if(toast.remove) toast.remove(); }, 400);
            }, 2700);
        }





  // # er jaygay contact 
        
        // Buttons events
const btnConsult = document.getElementById('heroBtn1');
const btnLibrary = document.getElementById('heroBtn2');

if (btnConsult) {
    btnConsult.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'contact.html';
    });
}

if (btnLibrary) {
    btnLibrary.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'contact.html';
    });
}
 // # er jaygay contact 





        // scroll reveal observer
        const revealEls = document.querySelectorAll('.hero35');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('hero36');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: "0px 0px -20px 0px" });
        revealEls.forEach(el => observer.observe(el));
        
        window.addEventListener('load', () => {
            revealEls.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight - 100) {
                    el.classList.add('hero36');
                    observer.unobserve(el);
                }
            });
        });

        // enhanced image interaction: 3D tilt effect on desktop (premium)
        const imgWrap = document.getElementById('heroImgWrap');
        if (imgWrap && window.innerWidth > 880) {
            document.addEventListener('mousemove', (e) => {
                const rect = imgWrap.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const deltaX = (e.clientX - centerX) / 25;
                const deltaY = (e.clientY - centerY) / 25;
                const maxRotate = 8;
                const rotX = Math.min(maxRotate, Math.max(-maxRotate, deltaY));
                const rotY = Math.min(maxRotate, Math.max(-maxRotate, -deltaX));
                imgWrap.style.transform = `perspective(1000px) rotateX(${rotX * 0.6}deg) rotateY(${rotY * 0.6}deg) translateY(-4px)`;
                imgWrap.style.transition = 'transform 0.1s ease-out';
            });
            document.addEventListener('mouseleave', () => {
                imgWrap.style.transform = '';
                imgWrap.style.transition = 'transform 0.4s ease';
            });
        }
        
        // subtle particle effect on image click
        const imgInner = document.querySelector('.hero32');
        if (imgInner) {
            imgInner.addEventListener('click', () => {
                const ripple = document.createElement('div');
                ripple.style.position = 'absolute';
                ripple.style.width = '40px';
                ripple.style.height = '40px';
                ripple.style.borderRadius = '50%';
                ripple.style.background = 'rgba(184,134,11,0.4)';
                ripple.style.top = '50%';
                ripple.style.left = '50%';
                ripple.style.transform = 'translate(-50%, -50%) scale(0)';
                ripple.style.pointerEvents = 'none';
                ripple.style.animation = 'heroRipple 0.6s ease-out forwards';
                imgInner.style.position = 'relative';
                imgInner.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            });
        }
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `@keyframes heroRipple {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0.7; }
            100% { transform: translate(-50%, -50%) scale(6); opacity: 0; }
        }`;
        document.head.appendChild(styleSheet);
    })();








































    
})(jQuery);

