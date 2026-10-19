import smtplib
import os
from email.mime.text import MIMEText
from email.header import Header

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
        
        # 【关键修复】From 头部必须严格遵循 RFC 规范，移除 'utf-8' 编码参数
        # 使用标准格式：昵称 <邮箱地址>
        message['From'] = Header(f"签到机器人 <{SENDER_EMAIL}>") 
        message['To'] = Header(f"主人 <{RECEIVER_EMAIL}>")
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
