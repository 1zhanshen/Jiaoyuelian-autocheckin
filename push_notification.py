import smtplib
import os
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr  # 【关键修复】导入标准格式化工具

# --- 配置区 ---
SMTP_SERVER = "smtp.qq.com"
SMTP_PORT = 465
SENDER_EMAIL = "768328519@qq.com"    # 请替换为你的发件邮箱
SENDER_AUTH_CODE = os.environ.get('EMAIL_AUTH_CODE')
RECEIVER_EMAIL = "768328519@qq.com"  # 请替换为你的收件邮箱

def send_email_notification(result_text):
    if not SENDER_AUTH_CODE:
        print("未配置邮箱授权码，跳过邮件发送。")
        return
    try:
        message = MIMEText(result_text, 'plain', 'utf-8')
        
        # 【关键修复】使用标准方法格式化头部，并使用纯英文昵称
        message['From'] = formataddr(("Checkin Bot", SENDER_EMAIL))
        message['To'] = formataddr(("Owner", RECEIVER_EMAIL))
        message['Subject'] = Header("皎月连签到结果", 'utf-8')

        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SENDER_EMAIL, SENDER_AUTH_CODE)
        server.sendmail(SENDER_EMAIL, [RECEIVER_EMAIL], message.as_string())
        server.quit()
        print("邮件发送成功！")
    except Exception as e:
        print(f"邮件发送失败: {e}")

if __name__ == "__main__":
    import sys
    result = sys.argv[1] if len(sys.argv) > 1 else "未收到签到结果"
    send_email_notification(result)
