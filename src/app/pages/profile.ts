import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ACTIVITY_FACTOR, dayTargets, mealTargets, warnings } from '../core/calc';
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '../core/dates';
import { MEALS, MealId, Profile } from '../core/models';
import { Store } from '../core/store';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="page stack">
      <h1>Perfil</h1>

      @if (backupDue(); as d) {
        <div class="card due">
          <strong>{{ d }}</strong>
          <div class="muted">Si borras la app o cambias de móvil, los datos no se pueden recuperar sin una copia.</div>
          <button class="primary" (click)="exportData()">Exportar copia ahora</button>
        </div>
      }

      <div class="card stack">
        <h2>Peso</h2>
        <div class="row">
          <input type="number" inputmode="decimal" step="0.1" min="30" max="300" placeholder="kg" [ngModel]="weightInput()" (ngModelChange)="weightInput.set($event)" />
          <button class="primary" [disabled]="!validWeight()" (click)="addWeight()">Registrar hoy</button>
        </div>
        @if (store.latestKg(); as kg) {
          <div class="muted">Último peso: <strong>{{ kg | number: '1.0-1' }} kg</strong></div>
        } @else {
          <div class="warn">Registra tu peso para calcular tus calorías.</div>
        }
        @if (spark(); as s) {
          <svg viewBox="0 0 300 60" class="spark" role="img" aria-label="Evolución del peso">
            <polyline [attr.points]="s" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        }
        @for (w of lastWeights(); track w.date) {
          <div class="row between small">
            <span class="muted">{{ w.date }}</span>
            <span>{{ w.kg | number: '1.0-1' }} kg</span>
            <button class="link" (click)="store.deleteWeight(w.date)">Borrar</button>
          </div>
        }
      </div>

      <div class="card stack">
        <h2>Datos personales</h2>
        <div class="grid2">
          <label class="field">Sexo
            <select [ngModel]="form().sex" (ngModelChange)="patch({ sex: $event })">
              <option value="H">Hombre</option>
              <option value="M">Mujer</option>
            </select>
          </label>
          <label class="field">Edad
            <input type="number" inputmode="numeric" min="14" max="100" [ngModel]="form().age" (ngModelChange)="patch({ age: +$event })" />
          </label>
        </div>
        <div class="grid2">
          <label class="field">Altura (cm)
            <input type="number" inputmode="numeric" min="120" max="230" [ngModel]="form().heightCm" (ngModelChange)="patch({ heightCm: +$event })" />
          </label>
          <label class="field">Nivel de ejercicio
            <select [ngModel]="form().activity" (ngModelChange)="patch({ activity: $event })">
              <option value="bajo">Bajo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
            </select>
          </label>
        </div>
      </div>

      <div class="card stack">
        <h2>Objetivo semanal</h2>
        <label class="field">Kilos por semana (negativo = perder, positivo = ganar)
          <input type="number" inputmode="decimal" step="0.05" min="-1.5" max="1" [ngModel]="form().weeklyGoalKg" (ngModelChange)="patch({ weeklyGoalKg: +$event })" />
        </label>
      </div>

      <div class="card stack">
        <h2>Comidas habituales</h2>
        <div class="muted">Elige las que haces y qué % de las calorías del día toma cada una (se ajusta al 100 % automáticamente).</div>
        @for (m of meals; track m.id) {
          <div class="row">
            <input type="checkbox" class="chk" [checked]="form().meals.includes(m.id)" (change)="toggleMeal(m.id)" [id]="'m-' + m.id" />
            <label class="grow" [for]="'m-' + m.id">{{ m.label }}</label>
            @if (form().meals.includes(m.id)) {
              <input class="pct" type="number" inputmode="numeric" min="0" max="100" [ngModel]="form().mealPct[m.id]" (ngModelChange)="setPct(m.id, +$event)" />
              <span class="muted">%</span>
            }
          </div>
        }
      </div>

      <div class="card stack">
        <h2>Distribución semanal</h2>
        <div class="muted">¿Qué días sueles tomar más calorías?</div>
        <div class="chips">
          @for (d of weekOrder; track d) {
            <button class="chip" [class.on]="form().highDays.includes(d)" [attr.aria-label]="dayNames[d]" (click)="toggleDay(d)">{{ dayShort[d] }}</button>
          }
        </div>
        @if (form().highDays.length) {
          <label class="field">% extra en esos días (el resto de días baja para mantener la semana)
            <input type="number" inputmode="numeric" min="0" max="60" [ngModel]="form().highDayPct" (ngModelChange)="patch({ highDayPct: +$event })" />
          </label>
        }
      </div>

      @if (preview(); as pv) {
        <div class="card stack">
          <h2>Tu objetivo</h2>
          <div class="row between"><span>Día normal</span><strong>{{ pv.t.normal | number: '1.0-0' }} kcal</strong></div>
          @if (form().highDays.length) {
            <div class="row between"><span>Día alto</span><strong>{{ pv.t.high | number: '1.0-0' }} kcal</strong></div>
          }
          <div class="muted">
            @for (m of pv.meals; track m.label) { {{ m.label }} {{ m.kcal }} · }
            (día normal)
          </div>
          @for (w of pv.warn; track w) {
            <div class="warn">⚠ {{ w }}</div>
          }
          <div class="muted small">Estimación orientativa (Mifflin-St Jeor × actividad {{ factor() }}). No sustituye consejo médico o nutricional.</div>
        </div>
      }

      <button class="primary" (click)="save()">Guardar perfil</button>
      @if (saved()) {
        <div class="muted">Guardado.</div>
      }

      <div class="card stack">
        <h2>Copia de seguridad</h2>
        <div class="muted">
          Tus datos viven solo en este teléfono. Exporta un archivo de vez en cuando (por ejemplo a iCloud Drive) para no perderlos si se borran los datos de Safari o cambias de móvil.
          @if (store.persisted() === false) {
            <span class="warn"> iOS no ha confirmado almacenamiento persistente: instala la app en la pantalla de inicio.</span>
          }
        </div>
        <div class="row">
          <button (click)="exportData()">Exportar</button>
          <button (click)="file.click()">Importar</button>
          <input #file type="file" accept="application/json,.json" hidden (change)="importData($event)" />
        </div>
        <div class="muted">{{ lastBackupText() }}</div>
        @if (backupMsg()) {
          <div [class.error]="backupError()" class="muted">{{ backupMsg() }}</div>
        }
      </div>
    </div>
  `,
  styles: `
    .due {
      border-color: var(--warn);
    }
    .spark {
      width: 100%;
      height: 60px;
    }
    .small {
      font-size: 0.85rem;
    }
    .chk {
      width: 22px;
      min-height: 22px;
      height: 22px;
    }
    .pct {
      width: 72px;
      text-align: right;
    }
  `,
})
export class ProfilePage {
  protected readonly store = inject(Store);
  protected readonly meals = MEALS;
  protected readonly weekOrder = [1, 2, 3, 4, 5, 6, 0];
  protected readonly dayShort = WEEKDAY_SHORT;
  protected readonly dayNames = WEEKDAY_NAMES;

  protected readonly form = signal<Profile>(structuredClone(this.store.profile()));
  protected readonly weightInput = signal<number | null>(null);
  protected readonly saved = signal(false);
  protected readonly backupMsg = signal('');
  protected readonly backupError = signal(false);

  private readonly hasData = signal(false);

  constructor() {
    void this.store.hasData().then((v) => this.hasData.set(v));
  }

  private daysSinceBackup(): number | null {
    const last = this.store.lastBackup();
    return last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null;
  }

  /** Aviso discreto (solo en esta pantalla, sin notificaciones) si hay datos y la copia es antigua. */
  protected readonly backupDue = computed(() => {
    if (!this.hasData()) return '';
    const d = this.daysSinceBackup();
    if (d === null) return 'Aún no has hecho ninguna copia de seguridad.';
    return d >= 7 ? `Tu última copia tiene ${d} días.` : '';
  });

  protected readonly lastBackupText = computed(() => {
    const d = this.daysSinceBackup();
    if (d === null) return 'Última copia: ninguna en este dispositivo.';
    return d === 0 ? 'Última copia: hoy.' : `Última copia: hace ${d} día${d === 1 ? '' : 's'}.`;
  });

  protected readonly validWeight = computed(() => {
    const w = Number(this.weightInput());
    return w >= 30 && w <= 300;
  });

  protected readonly lastWeights = computed(() => [...this.store.weights()].reverse().slice(0, 5));

  protected readonly spark = computed(() => {
    const w = this.store.weights().slice(-30);
    if (w.length < 2) return null;
    const min = Math.min(...w.map((x) => x.kg));
    const max = Math.max(...w.map((x) => x.kg));
    const span = max - min || 1;
    return w
      .map((x, i) => `${(i / (w.length - 1)) * 300},${55 - ((x.kg - min) / span) * 50}`)
      .join(' ');
  });

  protected readonly factor = computed(() => ACTIVITY_FACTOR[this.form().activity]);

  protected readonly preview = computed(() => {
    const kg = this.store.latestKg();
    if (kg === null) return null;
    const f = this.form();
    const t = dayTargets(f, kg);
    const mt = mealTargets(f, t.normal);
    return {
      t,
      warn: warnings(f, kg),
      meals: MEALS.filter((m) => f.meals.includes(m.id)).map((m) => ({ label: m.label, kcal: mt[m.id] ?? 0 })),
    };
  });

  protected patch(p: Partial<Profile>): void {
    this.saved.set(false);
    this.form.update((f) => ({ ...f, ...p }) as Profile);
  }

  protected toggleMeal(id: MealId): void {
    const cur = this.form().meals;
    const next = cur.includes(id) ? cur.filter((m) => m !== id) : MEALS.map((m) => m.id).filter((m) => m === id || cur.includes(m));
    this.patch({ meals: next.length ? next : cur });
  }

  protected setPct(id: MealId, v: number): void {
    this.patch({ mealPct: { ...this.form().mealPct, [id]: Math.max(0, v || 0) } });
  }

  protected toggleDay(d: number): void {
    const cur = this.form().highDays;
    this.patch({ highDays: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] });
  }

  protected async addWeight(): Promise<void> {
    await this.store.setWeight(Number(this.weightInput()));
    this.weightInput.set(null);
  }

  protected async save(): Promise<void> {
    await this.store.saveProfile(this.form());
    this.saved.set(true);
  }

  protected async exportData(): Promise<void> {
    const data = await this.store.exportAll();
    const name = `contador-calorias-${data.exportedAt.slice(0, 10)}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        this.store.markBackup();
        this.report('Copia exportada.', false);
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    this.store.markBackup();
    this.report('Copia exportada.', false);
  }

  protected async importData(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!window.confirm('Importar reemplazará TODOS los datos actuales por los del archivo. ¿Continuar?')) return;
    try {
      await this.store.importAll(JSON.parse(await file.text()));
      this.form.set(structuredClone(this.store.profile()));
      this.store.markBackup();
      this.hasData.set(await this.store.hasData());
      this.report('Copia importada.', false);
    } catch (e) {
      this.report((e as Error).message || 'No se pudo importar el archivo.', true);
    }
  }

  private report(msg: string, error: boolean): void {
    this.backupMsg.set(msg);
    this.backupError.set(error);
  }
}
