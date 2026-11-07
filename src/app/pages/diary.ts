import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mealTargets, sumMacros, targetForDate } from '../core/calc';
import { addDays, formatDayLabel, todayIso } from '../core/dates';
import { Entry, MEALS, MealId, mealLabel } from '../core/models';
import { Store } from '../core/store';
import { GramSheet } from '../ui/gram-sheet';

@Component({
  selector: 'app-diary',
  imports: [DecimalPipe, RouterLink, GramSheet],
  template: `
    <div class="page" (touchstart)="touchStart($event)" (touchend)="touchEnd($event)">
      <div class="row between head">
        <button class="link" (click)="shift(-1)" aria-label="Día anterior">‹</button>
        <label class="datepick">
          <strong>{{ label() }}</strong>
          <input type="date" [value]="date()" [max]="today" (change)="pick($any($event.target).value)" />
        </label>
        <button class="link" (click)="shift(1)" aria-label="Día siguiente" [disabled]="date() >= today">›</button>
      </div>

      @if (!ready()) {
        <div class="card">
          <strong>Configura tu perfil</strong>
          <p class="muted">Necesito tu peso, altura, edad y objetivo para calcular las calorías recomendadas.</p>
          <a routerLink="/perfil"><button class="primary">Ir a Perfil</button></a>
        </div>
      }

      <div class="card">
        <div class="row between">
          <div>
            <div class="big">{{ eaten() | number: '1.0-0' }}</div>
            <div class="muted">consumidas</div>
          </div>
          @if (ready()) {
            <div class="right">
              <div class="big" [class.warn]="remaining() < 0">{{ remaining() | number: '1.0-0' }}</div>
              <div class="muted">{{ remaining() < 0 ? 'de más' : 'restantes' }} · objetivo {{ target() | number: '1.0-0' }}</div>
            </div>
          }
        </div>
        @if (ready()) {
          <div class="bar" [class.over]="eaten() > target()"><span [style.width.%]="pct(eaten(), target())"></span></div>
        }
      </div>

      @for (r of rows(); track r.id) {
        <div class="card">
          <div class="row between">
            <div class="grow">
              <strong>{{ r.label }}</strong>
              <div class="muted">
                {{ r.kcal | number: '1.0-0' }}
                @if (r.target !== null) {
                  / {{ r.target | number: '1.0-0' }}
                }
                kcal
              </div>
            </div>
            <a [routerLink]="['/anadir', date(), r.id]"><button class="primary plus" aria-label="Añadir a {{ r.label }}">+</button></a>
          </div>
          @if (r.target !== null) {
            <div class="bar" [class.over]="r.kcal > r.target"><span [style.width.%]="pct(r.kcal, r.target)"></span></div>
          }
          @for (e of r.entries; track e.id) {
            <button class="list-item" (click)="editing.set(e)">
              <span class="grow">
                {{ e.name }}
                <span class="muted">{{ e.brand }} {{ e.grams ? '· ' + e.grams + ' g' : '' }}</span>
              </span>
              <span>{{ e.kcal | number: '1.0-0' }}</span>
            </button>
          }
          <div class="row actions">
            <button class="link" (click)="copyFromYesterday(r.id)">Copiar de ayer</button>
            @if (r.entries.length) {
              <button class="link" (click)="saveAsHabitual(r.id)">Guardar como habitual</button>
            }
          </div>
        </div>
      }
      @if (msg()) {
        <p class="muted center">{{ msg() }}</p>
      }
    </div>

    @if (editing(); as e) {
      @if (e.per100) {
        <app-gram-sheet
          [title]="e.name"
          [subtitle]="e.brand"
          [per100]="e.per100"
          [initialGrams]="e.grams"
          confirmLabel="Guardar"
          [removable]="true"
          (confirmed)="changeGrams(e, $event)"
          (removed)="remove(e)"
          (cancelled)="editing.set(null)"
        />
      } @else {
        <div class="backdrop2" (click)="editing.set(null)"></div>
        <div class="sheet2">
          <h2>{{ e.name }} · {{ e.kcal | number: '1.0-0' }} kcal</h2>
          <div class="row">
            <button class="danger" (click)="remove(e)">Eliminar</button>
            <span class="grow"></span>
            <button (click)="editing.set(null)">Cerrar</button>
          </div>
        </div>
      }
    }
  `,
  styles: `
    .head {
      margin-bottom: 8px;
    }
    .head .link {
      font-size: 1.8rem;
      min-width: 44px;
    }
    .datepick {
      position: relative;
      text-align: center;
      font-size: 1.1rem;
      text-transform: capitalize;
    }
    .datepick input {
      position: absolute;
      inset: 0;
      opacity: 0;
      width: 100%;
    }
    .big {
      font-size: 1.9rem;
      font-weight: 700;
    }
    .plus {
      width: 46px;
      font-size: 1.5rem;
      padding: 0;
    }
    .bar {
      margin: 8px 0 4px;
    }
    .actions {
      margin-top: 4px;
    }
    .center {
      text-align: center;
    }
    .backdrop2 {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 40;
    }
    .sheet2 {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 41;
      background: var(--card);
      padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
      border-radius: 18px 18px 0 0;
      display: grid;
      gap: 10px;
    }
  `,
})
export class Diary {
  private readonly store = inject(Store);

  protected readonly today = todayIso();
  protected readonly date = this.store.selectedDate;
  protected readonly label = computed(() => formatDayLabel(this.date()));
  protected readonly editing = signal<Entry | null>(null);
  protected readonly msg = signal('');

  private readonly entries = resource({
    params: () => ({ d: this.date(), v: this.store.rev() }),
    loader: ({ params }) => this.store.entriesBetween(params.d, params.d),
  });
  private readonly list = computed(() => this.entries.value() ?? []);

  protected readonly ready = computed(() => this.store.profile().configured && this.store.latestKg() !== null);
  protected readonly target = computed(() =>
    this.ready() ? targetForDate(this.store.profile(), this.store.latestKg()!, this.date()) : 0,
  );
  protected readonly eaten = computed(() => sumMacros(this.list()).kcal);
  protected readonly remaining = computed(() => this.target() - this.eaten());

  protected readonly rows = computed(() => {
    const p = this.store.profile();
    const targets = this.ready() ? mealTargets(p, this.target()) : {};
    const ids = MEALS.map((m) => m.id).filter(
      (id) => p.meals.includes(id) || this.list().some((e) => e.meal === id),
    );
    return ids.map((id) => {
      const entries = this.list().filter((e) => e.meal === id);
      return {
        id,
        label: mealLabel(id),
        entries,
        kcal: sumMacros(entries).kcal,
        target: targets[id] ?? null,
      };
    });
  });

  protected pct(v: number, total: number): number {
    return total > 0 ? Math.min(100, (v / total) * 100) : 0;
  }

  protected shift(n: number): void {
    const next = addDays(this.date(), n);
    if (next <= this.today) this.store.selectedDate.set(next);
  }

  protected pick(v: string): void {
    if (v && v <= this.today) this.store.selectedDate.set(v);
  }

  private startX = 0;
  private startY = 0;
  protected touchStart(ev: TouchEvent): void {
    this.startX = ev.changedTouches[0].clientX;
    this.startY = ev.changedTouches[0].clientY;
  }
  protected touchEnd(ev: TouchEvent): void {
    const dx = ev.changedTouches[0].clientX - this.startX;
    const dy = ev.changedTouches[0].clientY - this.startY;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) this.shift(dx > 0 ? -1 : 1);
  }

  protected async changeGrams(e: Entry, grams: number): Promise<void> {
    await this.store.updateEntryGrams(e, grams);
    this.editing.set(null);
  }

  protected async remove(e: Entry): Promise<void> {
    if (e.id) await this.store.deleteEntry(e.id);
    this.editing.set(null);
  }

  protected async copyFromYesterday(meal: MealId): Promise<void> {
    const n = await this.store.copyMeal(addDays(this.date(), -1), this.date(), meal);
    this.msg.set(n ? `Copiados ${n} alimentos de ayer.` : 'Ayer no hay nada registrado en esta comida.');
  }

  protected async saveAsHabitual(meal: MealId): Promise<void> {
    const entries = this.list().filter((e) => e.meal === meal && e.per100);
    if (!entries.length) {
      this.msg.set('Esta comida no tiene alimentos con cantidad para guardar.');
      return;
    }
    const name = window.prompt('Nombre de la comida habitual', `${mealLabel(meal)} diario`)?.trim();
    if (!name) return;
    await this.store.saveMeal({
      name,
      items: entries.map((e) => ({
        foodId: e.foodId,
        name: e.name,
        brand: e.brand,
        grams: e.grams,
        per100: e.per100!,
      })),
    });
    this.msg.set(`Guardada como habitual. Edítala desde “+” → Mis comidas.`);
  }
}
