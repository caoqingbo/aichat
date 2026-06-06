const menuButton = document.querySelector(".wb-menu-btn");
const navLinks = document.querySelector(".wb-nav-links");
const navActions = document.querySelector(".wb-nav-actions");

if (menuButton && navLinks && navActions) {
    menuButton.addEventListener("click", () => {
        const expanded = menuButton.getAttribute("aria-expanded") === "true";
        menuButton.setAttribute("aria-expanded", String(!expanded));
        navLinks.classList.toggle("is-open", !expanded);
        navActions.classList.toggle("is-open", !expanded);
    });
}

const revealSections = document.querySelectorAll(".section-reveal");

if ("IntersectionObserver" in window && revealSections.length > 0) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    revealSections.forEach((section) => observer.observe(section));
} else {
    revealSections.forEach((section) => section.classList.add("is-visible"));
}
