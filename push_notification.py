import smtplib
import os
from email.mime.text import MIMEText
from email.header import Header

# --- 配置区 ---
SMTP_SERVER = "smtp.qq.com"       # QQ邮箱用 smtp.qq.com，163邮箱用 smtp.163.com
SMTP_PORT = 465                    # 一般用 465（SSL加密）
SENDER_EMAIL = "768328519@qq.com"    # 你的发件邮箱
SENDER_AUTH_CODE = os.environ.get('EMAIL_AUTH_CODE')  # 从GitHub Secrets读取授权码
RECEIVER_EMAIL = "768328519@qq.com"  # 收件邮箱，可以填同一个

def send_email_notification(result_text):
    if not SENDER_AUTH_CODE:
        print("未配置邮箱授权码，跳过邮件发送。")
        return
    try:
        message = MIMEText(result_text, 'plain', 'utf-8')
        message['From'] = Header("签到机器人", 'utf-8')
        message['To'] = Header("主人", 'utf-8')
        message['Subject'] = Header("皎月连签到结果", 'utf-8')

        # 使用 SSL 加密连接
        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SENDER_EMAIL, SENDER_AUTH_CODE)
        server.sendmail(SENDER_EMAIL, [RECEIVER_EMAIL], message.as_string())
        server.quit()
        print("邮件发送成功！")
    except Exception as e:
        print(f"邮件发送失败: {e}")

if __name__ == "__main__":
    import sys
    # 从命令行接收 checkin.js 传来的签到结果
    result = sys.argv[1] if len(sys.argv) > 1 else "未收到签到结果"
    send_email_notification(result)
