/**
 * ImageCropper - Canvas-based region selection for OCR images.
 * Allows users to draw a rectangle on the image to select a portion for translation.
 */
(function () {
  'use strict';

  class ImageCropper {
    constructor(canvas) {
      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');
      this._image = null;
      this._scale = 1;
      this._offsetX = 0;
      this._offsetY = 0;

      // Selection state
      this._isDrawing = false;
      this._startX = 0;
      this._startY = 0;
      this._selectionRect = null; // { x, y, w, h } in image coordinates

      // Callbacks
      this._onSelectionChange = null;

      // Bind events
      this._bindEvents();
    }

    /**
     * Set callback when selection changes.
     * @param {Function} callback - receives (hasSelection: boolean)
     */
    onSelectionChange(callback) {
      this._onSelectionChange = callback;
    }

    /**
     * Load an image from a File/Blob into the canvas.
     * @param {File|Blob} file - The image file
     * @returns {Promise<void>}
     */
    loadImage(file) {
      var self = this;
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          self._image = img;
          self._selectionRect = null;
          self._fitAndDraw();
          if (self._onSelectionChange) self._onSelectionChange(false);
          resolve();
        };
        img.onerror = function () { reject(new Error('Failed to load image')); };

        if (file instanceof Blob) {
          var reader = new FileReader();
          reader.onload = function (e) { img.src = e.target.result; };
          reader.onerror = function () { reject(new Error('Failed to read file')); };
          reader.readAsDataURL(file);
        } else {
          img.src = file;
        }
      });
    }

    /**
     * Get the cropped region as a canvas/blob, or null if no selection.
     * @returns {HTMLCanvasElement|null}
     */
    getCroppedCanvas() {
      if (!this._selectionRect || !this._image) return null;

      var r = this._selectionRect;
      var cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, Math.round(r.w));
      cropCanvas.height = Math.max(1, Math.round(r.h));
      var ctx = cropCanvas.getContext('2d');
      ctx.drawImage(this._image, r.x, r.y, r.w, r.h, 0, 0, cropCanvas.width, cropCanvas.height);
      return cropCanvas;
    }

    /**
     * Get the full image as a canvas (for "Translate All").
     * @returns {HTMLCanvasElement|null}
     */
    getFullCanvas() {
      if (!this._image) return null;
      var fullCanvas = document.createElement('canvas');
      fullCanvas.width = this._image.naturalWidth;
      fullCanvas.height = this._image.naturalHeight;
      var ctx = fullCanvas.getContext('2d');
      ctx.drawImage(this._image, 0, 0);
      return fullCanvas;
    }

    /**
     * Check if there is a selection.
     * @returns {boolean}
     */
    hasSelection() {
      return this._selectionRect !== null &&
             this._selectionRect.w > 10 &&
             this._selectionRect.h > 10;
    }

    /**
     * Reset/clear the selection.
     */
    resetSelection() {
      this._selectionRect = null;
      this._drawImage();
      if (this._onSelectionChange) this._onSelectionChange(false);
    }

    /**
     * Clear everything.
     */
    clear() {
      this._image = null;
      this._selectionRect = null;
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }

    // ─── Private ─────────────────────────────────────────

    _fitAndDraw() {
      var container = this._canvas.parentElement;
      var maxW = container.clientWidth || 400;
      var maxH = 280;

      var imgW = this._image.naturalWidth;
      var imgH = this._image.naturalHeight;

      this._scale = Math.min(maxW / imgW, maxH / imgH, 1);

      this._canvas.width = Math.round(imgW * this._scale);
      this._canvas.height = Math.round(imgH * this._scale);

      this._drawImage();
    }

    _drawImage() {
      var ctx = this._ctx;
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      ctx.drawImage(this._image, 0, 0, this._canvas.width, this._canvas.height);

      // Draw selection overlay if exists
      if (this._selectionRect) {
        var r = this._selectionRect;
        var sx = r.x * this._scale;
        var sy = r.y * this._scale;
        var sw = r.w * this._scale;
        var sh = r.h * this._scale;

        // Dim outside selection
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        // Top
        ctx.fillRect(0, 0, this._canvas.width, sy);
        // Bottom
        ctx.fillRect(0, sy + sh, this._canvas.width, this._canvas.height - sy - sh);
        // Left
        ctx.fillRect(0, sy, sx, sh);
        // Right
        ctx.fillRect(sx + sw, sy, this._canvas.width - sx - sw, sh);

        // Selection border
        ctx.strokeStyle = '#4285f4';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]);

        // Corner handles
        var handleSize = 8;
        ctx.fillStyle = '#4285f4';
        ctx.fillRect(sx - handleSize / 2, sy - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(sx + sw - handleSize / 2, sy - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(sx - handleSize / 2, sy + sh - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(sx + sw - handleSize / 2, sy + sh - handleSize / 2, handleSize, handleSize);
      }
    }

    _bindEvents() {
      var self = this;
      var canvas = this._canvas;

      // Mouse events
      canvas.addEventListener('mousedown', function (e) { self._onPointerDown(e); });
      canvas.addEventListener('mousemove', function (e) { self._onPointerMove(e); });
      canvas.addEventListener('mouseup', function (e) { self._onPointerUp(e); });

      // Touch events
      canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        self._onPointerDown(self._touchToMouse(e));
      }, { passive: false });
      canvas.addEventListener('touchmove', function (e) {
        e.preventDefault();
        self._onPointerMove(self._touchToMouse(e));
      }, { passive: false });
      canvas.addEventListener('touchend', function (e) {
        e.preventDefault();
        self._onPointerUp(self._touchToMouse(e));
      }, { passive: false });
    }

    _touchToMouse(e) {
      var touch = e.touches[0] || e.changedTouches[0];
      var rect = this._canvas.getBoundingClientRect();
      return { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };
    }

    _onPointerDown(e) {
      if (!this._image) return;
      this._isDrawing = true;
      this._startX = e.offsetX;
      this._startY = e.offsetY;
      this._selectionRect = null;
    }

    _onPointerMove(e) {
      if (!this._isDrawing || !this._image) return;

      var x = Math.min(this._startX, e.offsetX);
      var y = Math.min(this._startY, e.offsetY);
      var w = Math.abs(e.offsetX - this._startX);
      var h = Math.abs(e.offsetY - this._startY);

      // Convert to image coordinates
      this._selectionRect = {
        x: x / this._scale,
        y: y / this._scale,
        w: w / this._scale,
        h: h / this._scale
      };

      this._drawImage();
    }

    _onPointerUp(e) {
      if (!this._isDrawing) return;
      this._isDrawing = false;

      var hasValid = this.hasSelection();
      if (this._onSelectionChange) this._onSelectionChange(hasValid);

      if (!hasValid) {
        this._selectionRect = null;
        this._drawImage();
      }
    }
  }

  window.ImageCropper = ImageCropper;
})();
