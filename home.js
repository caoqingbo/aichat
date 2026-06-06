const menuButton = document.querySelector(".wb-menu-btn");
const navLinks = document.querySelector(".wb-nav-links");

menuButton?.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    navLinks?.classList.toggle("open", !expanded);
});

document.querySelectorAll(".wb-nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
        menuButton?.setAttribute("aria-expanded", "false");
        navLinks?.classList.remove("open");
    });
});

const taskData = {
    marketing: {
        model: "GPT-5",
        cost: "中",
        speed: "快",
        reason: "适合复杂营销策略、结构化表达和多版本文案生成。",
    },
    summary: {
        model: "Claude",
        cost: "中",
        speed: "稳定",
        reason: "长上下文处理能力更强，适合文档总结和结构化提炼。",
    },
    code: {
        model: "GPT-5",
        cost: "高",
        speed: "快",
        reason: "适合复杂代码推理、调试和解释。",
    },
    translate: {
        model: "Claude",
        cost: "中",
        speed: "稳定",
        reason: "适合长篇英文论文翻译、语义保留和段落重写。",
    },
    finance: {
        model: "DeepSeek",
        cost: "低",
        speed: "快",
        reason: "适合数据密集型分析、表格提炼和结论归纳。",
    },
    agent: {
        model: "通义千问",
        cost: "低",
        speed: "很快",
        reason: "中文理解和本地化表达能力较强，适合搭建自动化流程。",
    },
};

const recModel = document.querySelector("#recModel");
const recCost = document.querySelector("#recCost");
const recSpeed = document.querySelector("#recSpeed");
const recReason = document.querySelector("#recReason");
const recCard = document.querySelector(".recommend-card");

document.querySelectorAll(".task-tags button").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".task-tags button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");

        const data = taskData[button.dataset.task];
        recCard?.classList.remove("pop");
        requestAnimationFrame(() => {
            if (recModel) recModel.textContent = data.model;
            if (recCost) recCost.textContent = data.cost;
            if (recSpeed) recSpeed.textContent = data.speed;
            if (recReason) recReason.textContent = data.reason;
            recCard?.classList.add("pop");
        });
    });
});

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
}, { threshold: 0.12 });

document.querySelectorAll(".section-reveal").forEach((section) => revealObserver.observe(section));

document.querySelector(".signup-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = "chat.html";
});

const accountSignupForm = document.querySelector("[data-account-signup-form]");
const signupStatus = document.querySelector(".signup-status");
const passwordMatchError = document.querySelector(".password-match-error");

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
        const fieldName = button.dataset.passwordToggle;
        const input = button.closest("form")?.querySelector(`input[name="${fieldName}"]`);
        if (!input) return;

        const shouldShow = input.type === "password";
        input.type = shouldShow ? "text" : "password";
        button.textContent = shouldShow ? "🙈" : "👁";
        button.setAttribute("aria-label", shouldShow ? "隐藏密码" : "显示密码");
        input.focus();
    });
});

function updatePasswordMatchState() {
    const password = accountSignupForm?.querySelector('input[name="password"]');
    const confirmPassword = accountSignupForm?.querySelector('input[name="confirmPassword"]');
    if (!password || !confirmPassword || !passwordMatchError) return true;

    const shouldWarn = password.value && confirmPassword.value && password.value !== confirmPassword.value;
    passwordMatchError.textContent = shouldWarn ? "两次密码不一致" : "";
    return !shouldWarn;
}

function isPasswordStrongEnough(password) {
    return password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

accountSignupForm?.querySelector('input[name="password"]')?.addEventListener("input", updatePasswordMatchState);
accountSignupForm?.querySelector('input[name="confirmPassword"]')?.addEventListener("input", updatePasswordMatchState);

accountSignupForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const account = accountSignupForm.querySelector('input[name="account"]');
    const password = accountSignupForm.querySelector('input[name="password"]');
    const confirmPassword = accountSignupForm.querySelector('input[name="confirmPassword"]');
    const securityEmail = accountSignupForm.querySelector('input[name="securityEmail"]');
    const fields = [account, password, confirmPassword, securityEmail];
    const emptyField = fields.find((field) => !field.value.trim());

    if (emptyField) {
        if (signupStatus) signupStatus.textContent = "请完整填写账号、密码、确认密码和安全邮箱";
        emptyField.focus();
        return;
    }

    if (!isPasswordStrongEnough(password.value)) {
        if (signupStatus) signupStatus.textContent = "密码至少6位，且必须包含数字和字母";
        password.focus();
        return;
    }

    if (!updatePasswordMatchState()) {
        confirmPassword.focus();
        return;
    }

    window.location.href = "chat.html";
});

const modelFilterButtons = document.querySelectorAll("[data-model-filter]");
const modelRows = document.querySelectorAll("[data-model-type]");

modelRows.forEach((row) => row.classList.remove("is-hidden"));

modelFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const filter = button.dataset.modelFilter;

        modelFilterButtons.forEach((item) => {
            const isActive = item === button;
            item.classList.toggle("active", isActive);
            item.setAttribute("aria-pressed", String(isActive));
        });

        modelRows.forEach((row) => {
            const shouldShow = filter === "all" || row.dataset.modelType === filter;
            row.classList.toggle("is-hidden", !shouldShow);
        });
    });
});
