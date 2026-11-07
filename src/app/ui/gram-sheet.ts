import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { scaleMacros } from '../core/calc';
import { Macros } from '../core/models';

/** Hoja inferior para elegir la cantidad (gramos) de un alimento. */
@Component({
  selector: 'app-gram-sheet',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="cancelled.emit()"></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <h2>{{ title() }}</h2>
      @if (subtitle()) {
        <div class="muted">{{ subtitle() }}</div>
      }
      <div class="muted">Por 100 g: {{ per100().kcal }} kcal · P {{ per100().protein }} · C {{ per100().carbs }} · G {{ per100().fat }}</div>

      <label class="field">
        Cantidad (g o ml)
        <input type="number" inputmode="decimal" min="0" step="1" [ngModel]="grams()" (ngModelChange)="grams.set(+$event || 0)" />
      </label>
      @if (servingG()) {
        <div class="chips">
          <button class="chip" (click)="grams.set(servingG()!)">1 ración ({{ servingG() }} g)</button>
          <button class="chip" (click)="grams.set(100)">100 g</button>
        </div>
      }
      <div class="total">
        <strong>{{ scaled().kcal | number:'1.0-0' }} kcal</strong>
        <span class="muted">P {{ scaled().protein | number:'1.0-1' }} · C {{ scaled().carbs | number:'1.0-1' }} · G {{ scaled().fat | number:'1.0-1' }}</span>
      </div>
      <div class="row">
        @if (removable()) {
          <button class="danger" (click)="removed.emit()">Eliminar</button>
        }
        <span class="grow"></span>
        <button (click)="cancelled.emit()">Cancelar</button>
        <button class="primary" [disabled]="grams() <= 0" (click)="confirmed.emit(grams())">{{ confirmLabel() }}</button>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 40;
    }
    .sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 41;
      background: var(--card);
      border-radius: 18px 18px 0 0;
      padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
      max-width: 640px;
      margin: 0 auto;
      display: grid;
      gap: 10px;
    }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
  `,
})
export class GramSheet implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly per100 = input.required<Macros>();
  readonly servingG = input<number>();
  readonly initialGrams = input<number>();
  readonly confirmLabel = input('Añadir');
  readonly removable = input(false);

  readonly confirmed = output<number>();
  readonly cancelled = output<void>();
  readonly removed = output<void>();

  protected readonly grams = signal(100);
  protected readonly scaled = computed(() => scaleMacros(this.per100(), this.grams()));

  ngOnInit(): void {
    this.grams.set(this.initialGrams() ?? this.servingG() ?? 100);
  }
}
