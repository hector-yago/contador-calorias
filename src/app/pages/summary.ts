import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { dayTargets, macroGoals, sumMacros, targetForDate } from '../core/calc';
import { addDays, fromIso, mondayOf, weekDays, WEEKDAY_SHORT, formatDayLabel } from '../core/dates';
import { Macros } from '../core/models';
import { Store } from '../core/store';

@Component({
  selector: 'app-summary',
  imports: [DecimalPipe, RouterLink],
  template: `
    <div class="page">
      <div class="tabs">
        <button [class.on]="mode() === 'dia'" (click)="mode.set('dia')">Día</button>
        <button [class.on]="mode() === 'semana'" (click)="mode.set('semana')">Semana</button>
      </div>

      <div class="row between nav">
        <button class="link big" (click)="shift(-1)" aria-label="Anterior">‹</button>
        <strong>{{ title() }}</strong>
        <button class="link big" (click)="shift(1)" aria-label="Siguiente" [disabled]="!canNext()">›</button>
      </div>

      @if (!ready()) {
        <div class="card">
          <p class="muted">Configura tu perfil y tu peso para ver restantes y objetivos.</p>
          <a routerLink="/perfil"><button class="primary">Ir a Perfil</button></a>
        </div>
      }

      <div class="card">
        <div class="row between">
          <div>
            <div class="big2">{{ totals().kcal | number: '1.0-0' }}</div>
            <div class="muted">consumidas</div>
          </div>
          @if (ready()) {
            <div class="right">
              <div class="big2" [class.warn]="remaining() < 0">{{ remaining() | number: '1.0-0' }}</div>
              <div class="muted">{{ remaining() < 0 ? 'de más' : 'restantes' }} · objetivo {{ goal() | number: '1.0-0' }}</div>
            </div>
          }
        </div>
        <div class="bar" [class.over]="totals().kcal > goal()"><span [style.width.%]="pct(totals().kcal, goal())"></span></div>
      </div>

      <div class="card stack">
        <h2>Macronutrientes</h2>
        @for (m of macros(); track m.key) {
          <div>
            <div class="row between">
              <span><span class="dot" [style.background]="m.color"></span>{{ m.label }}</span>
              <span>
                <strong>{{ m.grams | number: '1.0-0' }} g</strong>
                <span class="muted"> · {{ m.pct | number: '1.0-0' }} %
                  @if (ready()) { · objetivo {{ m.goal | number: '1.0-0' }} g }
                </span>
              </span>
            </div>
            @if (ready()) {
              <div class="bar"><span [style.width.%]="pct(m.grams, m.goal)" [style.background]="m.color"></span></div>
            }
          </div>
        }
        <p class="muted small">Los objetivos de macros son una referencia: proteína 1,8 g/kg, grasa 25 % de las kcal y el resto carbohidratos.</p>
      </div>

      @if (mode() === 'semana') {
        <div class="card">
          <h2>Por días</h2>
          <div class="days">
            @for (d of dayBars(); track d.iso) {
              <div class="day">
                <div class="col">
                  <span class="fill" [class.over]="d.over" [style.height.%]="d.h"></span>
                </div>
                <span class="muted">{{ d.label }}</span>
                <span class="small">{{ d.kcal | number: '1.0-0' }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .nav {
      margin: 10px 0;
    }
    .big {
      font-size: 1.8rem;
      min-width: 44px;
    }
    .big2 {
      font-size: 1.9rem;
      font-weight: 700;
    }
    .bar {
      margin-top: 8px;
    }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .small {
      font-size: 0.78rem;
    }
    .days {
      display: flex;
      gap: 6px;
    }
    .day {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .col {
      height: 110px;
      width: 100%;
      display: flex;
      align-items: flex-end;
      background: var(--bg);
      border-radius: 6px;
      overflow: hidden;
    }
    .fill {
      width: 100%;
      background: var(--accent);
    }
    .fill.over {
      background: var(--warn);
    }
  `,
})
export class Summary {
  private readonly store = inject(Store);
  protected readonly mode = signal<'dia' | 'semana'>('dia');
  private readonly date = this.store.selectedDate;

  protected readonly ready = computed(() => this.store.profile().configured && this.store.latestKg() !== null);

  private readonly range = computed(() => {
    const d = this.date();
    return this.mode() === 'dia' ? { from: d, to: d } : { from: mondayOf(d), to: addDays(mondayOf(d), 6) };
  });

  private readonly entries = resource({
    params: () => ({ r: this.range(), v: this.store.rev() }),
    loader: ({ params }) => this.store.entriesBetween(params.r.from, params.r.to),
  });
  private readonly list = computed(() => this.entries.value() ?? []);

  protected readonly title = computed(() => {
    if (this.mode() === 'dia') return formatDayLabel(this.date());
    const r = this.range();
    const f = (iso: string) => fromIso(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    return `${f(r.from)} – ${f(r.to)}`;
  });

  protected canNext(): boolean {
    return this.range().to < this.localToday();
  }

  private localToday(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  protected shift(n: number): void {
    const step = this.mode() === 'dia' ? n : n * 7;
    const next = addDays(this.date(), step);
    if (n > 0 && this.mode() === 'dia' && next > this.localToday()) return;
    this.store.selectedDate.set(n > 0 && next > this.localToday() ? this.localToday() : next);
  }

  protected readonly totals = computed<Macros>(() => sumMacros(this.list()));

  protected readonly goal = computed(() => {
    if (!this.ready()) return 0;
    const p = this.store.profile();
    const kg = this.store.latestKg()!;
    return this.mode() === 'dia' ? targetForDate(p, kg, this.date()) : dayTargets(p, kg).byDay.reduce((a, b) => a + b, 0);
  });

  protected readonly remaining = computed(() => this.goal() - this.totals().kcal);

  protected readonly macros = computed(() => {
    const t = this.totals();
    const kg = this.store.latestKg() ?? 0;
    const days = this.mode() === 'dia' ? 1 : 7;
    const g = this.ready() ? macroGoals(kg, this.goal() / days) : { protein: 0, carbs: 0, fat: 0 };
    const kcalOf = { protein: t.protein * 4, carbs: t.carbs * 4, fat: t.fat * 9 };
    const sum = kcalOf.protein + kcalOf.carbs + kcalOf.fat;
    const row = (key: 'carbs' | 'protein' | 'fat', label: string, color: string) => ({
      key,
      label,
      color,
      grams: t[key],
      goal: g[key] * days,
      pct: sum > 0 ? (kcalOf[key] / sum) * 100 : 0,
    });
    return [
      row('carbs', 'Carbohidratos', 'var(--carb)'),
      row('protein', 'Proteínas', 'var(--prot)'),
      row('fat', 'Grasas', 'var(--fat)'),
    ];
  });

  protected readonly dayBars = computed(() => {
    const byDate = new Map<string, number>();
    for (const e of this.list()) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.kcal);
    const days = weekDays(this.date());
    const targets = days.map((d) => (this.ready() ? targetForDate(this.store.profile(), this.store.latestKg()!, d) : 0));
    const max = Math.max(1, ...days.map((d) => byDate.get(d) ?? 0), ...targets);
    return days.map((iso, i) => {
      const kcal = byDate.get(iso) ?? 0;
      return {
        iso,
        kcal,
        label: WEEKDAY_SHORT[fromIso(iso).getDay()],
        h: (kcal / max) * 100,
        over: targets[i] > 0 && kcal > targets[i],
      };
    });
  });

  protected pct(v: number, total: number): number {
    return total > 0 ? Math.min(100, (v / total) * 100) : 0;
  }
}
