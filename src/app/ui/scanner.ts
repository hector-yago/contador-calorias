import { AfterViewInit, Component, ElementRef, OnDestroy, output, signal, viewChild } from '@angular/core';

/** Cámara trasera + lectura de códigos EAN/UPC con ZXing (carga diferida). */
@Component({
  selector: 'app-scanner',
  template: `
    <div class="box">
      <video #video playsinline muted></video>
      <div class="guide"></div>
    </div>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
  `,
  styles: `
    .box {
      position: relative;
      background: #000;
      border-radius: 14px;
      overflow: hidden;
      aspect-ratio: 4 / 3;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .guide {
      position: absolute;
      left: 10%;
      right: 10%;
      top: 35%;
      bottom: 35%;
      border: 2px solid rgba(255, 255, 255, 0.85);
      border-radius: 10px;
    }
  `,
})
export class Scanner implements AfterViewInit, OnDestroy {
  readonly detected = output<string>();
  protected readonly error = signal('');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private controls: { stop: () => void } | null = null;
  private destroyed = false;

  async ngAfterViewInit(): Promise<void> {
    try {
      const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ]);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      const reader = new BrowserMultiFormatReader(hints);
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        this.video().nativeElement,
        (result) => {
          if (result) {
            this.stop();
            this.detected.emit(result.getText());
          }
        },
      );
      if (this.destroyed) controls.stop();
      else this.controls = controls;
    } catch {
      this.error.set('No se pudo acceder a la cámara. Revisa el permiso de Safari o escribe el código a mano.');
    }
  }

  private stop(): void {
    this.controls?.stop();
    this.controls = null;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stop();
  }
}
