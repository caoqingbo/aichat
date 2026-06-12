import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn('[邮件] SMTP 未配置，验证码将直接返回到 API 响应中（仅开发环境）');
        return null;
    }

    transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    console.log(`[邮件] SMTP 已配置: ${host}:${port}`);
    return transporter;
}

/**
 * 发送密码重置验证码
 * @returns {{ success: boolean, code?: string, error?: string }}
 */
export async function sendResetCode(email, code) {
    const transport = getTransporter();

    // 开发模式：验证码直接返回
    if (!transport) {
        console.log(`[邮件] 开发模式 - ${email} 的验证码: ${code}`);
        return { success: true, code };
    }

    try {
        await transport.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: '易聊智能 - 密码重置验证码',
            html: `
                <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;">
                    <h2 style="color:#6366f1;">易聊智能</h2>
                    <p>您正在重置密码。验证码：</p>
                    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#333;padding:20px;background:#f5f5f5;text-align:center;border-radius:8px;">
                        ${code}
                    </div>
                    <p style="color:#888;margin-top:20px;">验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</p>
                </div>
            `,
        });
        console.log(`[邮件] 已发送验证码到 ${email}`);
        return { success: true };
    } catch (err) {
        console.error(`[邮件] 发送失败:`, err.message);
        return { success: false, error: err.message };
    }
}
