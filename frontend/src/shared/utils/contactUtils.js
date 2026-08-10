import { toast } from "sonner";

/**
 * Handles calling or copying a phone number based on the device type.
 * On mobile, it triggers the native dialer.
 * On desktop, it prevents the default behavior (like opening tel: link app selection) 
 * and copies the phone number to the clipboard with a toast notification.
 * 
 * @param {Event} [event] - The click event to preventDefault on desktop.
 * @param {string} phone - The phone number to call or copy.
 */
export function handlePhoneClick(event, phone) {
  if (!phone) return;

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobile) {
    // If it's a mobile device and the element is a standard <a> tag with tel: href,
    // let the browser handle it.
    const isAnchorTel =
      event &&
      event.currentTarget &&
      event.currentTarget.tagName === "A" &&
      event.currentTarget.getAttribute("href")?.startsWith("tel:");

    if (isAnchorTel) {
      return;
    }

    // Otherwise, manually trigger redirection
    window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
  } else {
    // On desktop, prevent default link behavior (prevents OS tel protocol handler popup)
    if (event) {
      event.preventDefault();
    }
    
    // Copy the phone number to clipboard
    navigator.clipboard.writeText(phone);
    toast.success(`Phone number copied to clipboard: ${phone}`);
  }
}

/**
 * Handles emailing or copying an email address based on the device type.
 * On mobile, it triggers the native mail client.
 * On desktop, it prevents the default behavior (which might do nothing if no client is set)
 * and copies the email to the clipboard with a toast notification.
 * 
 * @param {Event} [event] - The click event to preventDefault on desktop.
 * @param {string} email - The email address.
 */
export function handleEmailClick(event, email) {
  if (!email) return;

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (isMobile) {
    // If it's a mobile device and the element is a standard <a> tag with mailto: href,
    // let the browser handle it.
    const isAnchorMailto =
      event &&
      event.currentTarget &&
      event.currentTarget.tagName === "A" &&
      event.currentTarget.getAttribute("href")?.startsWith("mailto:");

    if (isAnchorMailto) {
      return;
    }

    // Otherwise, manually trigger redirection
    window.location.href = `mailto:${email}`;
  } else {
    // On desktop, prevent default link behavior
    if (event) {
      event.preventDefault();
    }
    
    // Copy the email to clipboard as backup
    navigator.clipboard.writeText(email);
    
    // Redirect to Gmail compose in a new tab
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
    
    toast.success(`Opening Gmail compose (copied to clipboard: ${email})`);
  }
}

