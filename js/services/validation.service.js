/**
 * Validation Service
 * Centralized input validation and sanitization
 */
class ValidationService {
  /**
   * Validate required field
   */
  static required(value, fieldName) {
    if (!value || value.toString().trim() === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
    return true;
  }

  /**
   * Validate number range
   */
  static numberRange(value, min, max, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new ValidationError(`${fieldName} must be a number`);
    }
    if (num < min || num > max) {
      throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
    }
    return true;
  }

  /**
   * Validate positive number
   */
  static positiveNumber(value, fieldName) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      throw new ValidationError(`${fieldName} must be a positive number`);
    }
    return true;
  }

  /**
   * Validate date format
   */
  static validDate(value, fieldName) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new ValidationError(`${fieldName} must be a valid date`);
    }
    return true;
  }

  /**
   * Validate string length
   */
  static stringLength(value, min, max, fieldName) {
    const length = value.toString().trim().length;
    if (length < min || length > max) {
      throw new ValidationError(`${fieldName} must be between ${min} and ${max} characters`);
    }
    return true;
  }

  /**
   * Validate email format
   */
  static email(value, fieldName) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid email`);
    }
    return true;
  }

  /**
   * Sanitize string (XSS prevention)
   */
  static sanitizeString(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  /**
   * Sanitize HTML (allow basic tags)
   */
  static sanitizeHTML(value) {
    const allowedTags = ['b', 'i', 'u', 'br', 'p'];
    const div = document.createElement('div');
    div.innerHTML = value;
    
    const walker = document.createTreeWalker(
      div,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (!allowedTags.includes(node.tagName.toLowerCase())) {
        node.parentNode.removeChild(node);
      }
    }
    
    return div.innerHTML;
  }

  /**
   * Validate invoice number uniqueness
   */
  static uniqueInvoiceNumber(invoiceNo, existingInvoices) {
    if (existingInvoices.some(inv => inv.invoiceNo === invoiceNo)) {
      throw new ValidationError('Invoice number already exists');
    }
    return true;
  }

  /**
   * Validate cutting form
   */
  static validateCuttingForm(formData) {
    const errors = [];

    try {
      this.required(formData.invoiceNo, 'Invoice Number');
    } catch (e) { errors.push(e.message); }

    try {
      this.required(formData.date, 'Date');
      this.validDate(formData.date, 'Date');
    } catch (e) { errors.push(e.message); }

    try {
      this.positiveNumber(formData.layers, 'Number of Cuts');
    } catch (e) { errors.push(e.message); }

    try {
      this.positiveNumber(formData.sizes, 'Layers per Cut');
    } catch (e) { errors.push(e.message); }

    try {
      this.positiveNumber(formData.rate, 'Unit Rate');
    } catch (e) { errors.push(e.message); }

    try {
      this.required(formData.status, 'Status');
    } catch (e) { errors.push(e.message); }

    return errors;
  }

  /**
   * Validate finishing form
   */
  static validateFinishingForm(formData) {
    const errors = [];

    try {
      this.required(formData.subInvoice, 'Sub Invoice Number');
    } catch (e) { errors.push(e.message); }

    try {
      this.required(formData.cutInvoice, 'Cut Invoice Reference');
    } catch (e) { errors.push(e.message); }

    try {
      this.required(formData.date, 'Date Received');
      this.validDate(formData.date, 'Date Received');
    } catch (e) { errors.push(e.message); }

    try {
      this.positiveNumber(formData.gradeA, 'Grade A Goods');
    } catch (e) { errors.push(e.message); }

    try {
      this.positiveNumber(formData.dmgComp, 'Damaged Complete');
    } catch (e) { errors.push(e.message); }

    try {
      this.positiveNumber(formData.waste, 'Waste');
    } catch (e) { errors.push(e.message); }

    return errors;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}