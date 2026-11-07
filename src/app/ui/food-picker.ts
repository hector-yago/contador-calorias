import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Food } from '../core/models';
import { OffService } from '../core/off.service';
import { Store } from '../core/store';
import { FoodForm } from './food-form';
import { GramSheet } from './gram-sheet';
import { Scanner } from './scanner';

export interface PickedFood {
  food: Food;
  grams: number;
}

/** Buscador de alimentos (guardados + Open Food Facts), escáner y alta manual. */
@Component({
  selector: 'app-food-picker',
  imports: [FormsModule, GramSheet, Scanner, FoodForm],
  template: `
    @if (creating()) {
      <app-food-form [initialBarcode]="createBarcode()" (saved)="foodReady($event)" (cancelled)="creating.set(false)" />
    } @else if (mode() === 'buscar') {
      <form class="row" (submit)="$event.preventDefault(); searchNow()">
        <input type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar producto (ej. leche hacendado)" [ngModel]="term()" (ngModelChange)="onTerm($event)" name="q" />
      </form>
      @if (loading()) {
        <p class="muted">Buscando…</p>
      }
      @if (error()) {
        <p class="warn">{{ error() }} <button class="link" (click)="searchNow()">Reintentar</button></p>
      }
      @if (!searched() && local().length) {
        <div class="muted">Recientes</div>
      }
      @for (f of local(); track f.id) {
        <button class="list-item" (click)="selected.set(f)">
          <span class="grow">{{ f.name }}<br /><span class="muted">{{ f.brand }}</span></span>
          <span class="muted">{{ f.per100.kcal }} kcal/100 g</span>
        </button>
      }
      @if (online().length) {
        <div class="muted">Open Food Facts</div>
      }
      @for (f of online(); track f.id) {
        <button class="list-item" (click)="selected.set(f)">
          <span class="grow">{{ f.name }}<br /><span class="muted">{{ f.brand }}{{ f.stores ? ' · ' + f.stores : '' }}</span></span>
          <span class="muted">{{ f.per100.kcal }} kcal/100 g</span>
        </button>
      }
      @if (searched() && !loading() && !local().length && !online().length && !error()) {
        <p class="muted">Sin resultados.</p>
      }
      <button class="link" (click)="startCreate('')">+ Crear alimento a mano</button>
    } @else {
      @if (scanning()) {
        <app-scanner (detected)="onCode($event)" />
        <p class="muted">Apunta al código de barras del producto.</p>
      }
      <form class="row" (submit)="$event.preventDefault(); onCode(manualCode())">
        <input inputmode="numeric" placeholder="O escribe el código" [ngModel]="manualCode()" (ngModelChange)="manualCode.set($event)" name="code" />
        <button type="submit" [disabled]="loading()">Buscar</button>
      </form>
      @if (loading()) {
        <p class="muted">Buscando…</p>
      }
      @if (notFound()) {
        <div class="card">
          <p>No encuentro el código {{ notFound() }}.</p>
          <button class="primary" (click)="startCreate(notFound()!)">Crear alimento con este código</button>
          <button class="link" (click)="rescan()">Escanear otro</button>
        </div>
      }
      @if (error()) {
        <p class="warn">{{ error() }}</p>
      }
    }

    @if (selected(); as f) {
      <app-gram-sheet
        [title]="f.name"
        [subtitle]="f.brand"
        [per100]="f.per100"
        [servingG]="f.servingG"
        [confirmLabel]="confirmLabel()"
        (confirmed)="confirm(f, $event)"
        (cancelled)="selected.set(null)"
      />
    }
  `,
  styles: `
    form {
      margin-bottom: 8px;
    }
  `,
})
export class FoodPicker {
  private readonly store_ = inject(Store);
  private readonly off = inject(OffService);

  readonly mode = input<'buscar' | 'codigo'>('buscar');
  readonly confirmLabel = input('Añadir');
  readonly picked = output<PickedFood>();

  protected readonly term = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private ctrl: AbortController | undefined;
  protected readonly local = signal<Food[]>([]);
  protected readonly online = signal<Food[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal<Food | null>(null);
  protected readonly creating = signal(false);
  protected readonly createBarcode = signal<string | undefined>(undefined);
  protected readonly scanning = signal(true);
  protected readonly manualCode = signal('');
  protected readonly notFound = signal<string | null>(null);

  constructor() {
    void this.store_.recentFoods().then((r) => this.local.set(r));
  }

  /** Autocompletado: guardados al instante y Open Food Facts tras una pausa al escribir. */
  protected onTerm(v: string): void {
    this.term.set(v);
    clearTimeout(this.timer);
    this.ctrl?.abort();
    const t = v.trim();
    if (t.length < 2) {
      this.searched.set(false);
      this.online.set([]);
      this.error.set('');
      this.loading.set(false);
      void this.store_.recentFoods().then((r) => this.local.set(r));
      return;
    }
    this.searched.set(true);
    this.error.set('');
    void this.store_.searchLocalFoods(t).then((l) => {
      if (this.term().trim() === t) this.local.set(l);
    });
    this.loading.set(true);
    this.timer = setTimeout(() => void this.search(), 500);
  }

  protected searchNow(): void {
    clearTimeout(this.timer);
    if (this.term().trim().length >= 2) void this.search();
  }

  private async search(): Promise<void> {
    const t = this.term().trim();
    this.ctrl?.abort();
    const ctrl = new AbortController();
    this.ctrl = ctrl;
    this.searched.set(true);
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await this.off.search(t, ctrl.signal);
      if (ctrl.signal.aborted) return;
      const localIds = new Set(this.local().map((f) => f.id));
      this.online.set(res.filter((f) => !localIds.has(f.id)));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      this.online.set([]);
      this.error.set((e as Error).message || 'No se pudo consultar Open Food Facts.');
    } finally {
      if (this.ctrl === ctrl) this.loading.set(false);
    }
  }

  protected async onCode(raw: string): Promise<void> {
    const code = raw.trim();
    if (!/^\d{6,14}$/.test(code)) {
      this.error.set('Código no válido.');
      return;
    }
    this.error.set('');
    this.notFound.set(null);
    this.scanning.set(false);
    this.loading.set(true);
    try {
      const found = (await this.store_.findFoodByBarcode(code)) ?? (await this.off.byBarcode(code));
      if (found) this.selected.set(found);
      else this.notFound.set(code);
    } catch (e) {
      this.error.set((e as Error).message || 'No se pudo consultar Open Food Facts.');
    } finally {
      this.loading.set(false);
    }
  }

  protected rescan(): void {
    this.notFound.set(null);
    this.scanning.set(true);
  }

  protected startCreate(barcode: string): void {
    this.createBarcode.set(barcode || undefined);
    this.creating.set(true);
  }

  protected foodReady(f: Food): void {
    this.creating.set(false);
    this.selected.set(f);
  }

  protected async confirm(food: Food, grams: number): Promise<void> {
    this.selected.set(null);
    this.picked.emit({ food, grams });
  }
}
