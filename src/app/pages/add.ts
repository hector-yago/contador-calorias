import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { sumMacros } from '../core/calc';
import { CustomMeal, MealId, mealLabel } from '../core/models';
import { Store } from '../core/store';
import { FoodPicker, PickedFood } from '../ui/food-picker';

@Component({
  selector: 'app-add',
  imports: [FoodPicker, FormsModule, DecimalPipe, RouterLink],
  template: `
    <div class="overlay">
      <div class="page stack">
        <div class="row between">
          <button class="link" (click)="back()">‹ Volver</button>
          <strong>{{ title() }}</strong>
          <button class="link" (click)="back()">Listo</button>
        </div>

        <div class="tabs">
          <button [class.on]="tab() === 'buscar'" (click)="tab.set('buscar')">Buscar</button>
          <button [class.on]="tab() === 'habituales'" (click)="tab.set('habituales')">Mis comidas</button>
          <button [class.on]="tab() === 'codigo'" (click)="tab.set('codigo')">Código</button>
          <button [class.on]="tab() === 'rapido'" (click)="tab.set('rapido')">Rápido</button>
        </div>

        @if (msg()) {
          <div class="card ok">{{ msg() }}</div>
        }

        @switch (tab()) {
          @case ('buscar') {
            <app-food-picker mode="buscar" (picked)="add($event)" />
          }
          @case ('codigo') {
            <app-food-picker mode="codigo" (picked)="add($event)" />
          }
          @case ('habituales') {
            @for (m of meals(); track m.id) {
              <div class="card">
                <div class="row">
                  <div class="grow">
                    <strong>{{ m.name }}</strong>
                    <div class="muted">{{ m.items.length }} alimentos · {{ kcal(m) | number: '1.0-0' }} kcal</div>
                    <div class="muted small">{{ names(m) }}</div>
                  </div>
                </div>
                <div class="row actions">
                  <button class="primary grow" (click)="addMeal(m)">Añadir</button>
                  <a [routerLink]="['/habitual', m.id]"><button>Editar</button></a>
                </div>
              </div>
            } @empty {
              <p class="muted">Aún no tienes comidas habituales. Crea una o, desde el Diario, usa “Guardar como habitual” en una comida ya rellena.</p>
            }
            <a [routerLink]="['/habitual', 'new']"><button class="primary">+ Nueva comida habitual</button></a>
          }
          @case ('rapido') {
            <div class="card stack">
              <h2>Calorías rápidas</h2>
              <div class="muted">Para algo que no encuentras: apunta solo las calorías (y opcionalmente macros).</div>
              <label class="field">Descripción
                <input [ngModel]="qName()" (ngModelChange)="qName.set($event)" />
              </label>
              <div class="grid2">
                <label class="field">kcal
                  <input type="number" inputmode="decimal" min="0" [ngModel]="qKcal()" (ngModelChange)="qKcal.set($event)" />
                </label>
                <label class="field">Proteínas (g)
                  <input type="number" inputmode="decimal" min="0" [ngModel]="qP()" (ngModelChange)="qP.set($event)" />
                </label>
                <label class="field">Carbohidratos (g)
                  <input type="number" inputmode="decimal" min="0" [ngModel]="qC()" (ngModelChange)="qC.set($event)" />
                </label>
                <label class="field">Grasas (g)
                  <input type="number" inputmode="decimal" min="0" [ngModel]="qF()" (ngModelChange)="qF.set($event)" />
                </label>
              </div>
              <button class="primary" [disabled]="!(qKcal() && +qKcal()! > 0)" (click)="addQuick()">Añadir</button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .ok {
      color: var(--accent);
      font-weight: 600;
    }
    .actions {
      margin-top: 8px;
    }
    .small {
      font-size: 0.8rem;
    }
  `,
})
export class AddPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  readonly date = input.required<string>();
  readonly meal = input.required<MealId>();

  protected readonly tab = signal<'buscar' | 'habituales' | 'codigo' | 'rapido'>('buscar');
  protected readonly msg = signal('');
  protected readonly title = computed(() => `Añadir a ${mealLabel(this.meal())}`);

  private readonly mealsRes = resource({
    params: () => this.store.rev(),
    loader: () => this.store.listMeals(),
  });
  protected readonly meals = computed(() => this.mealsRes.value() ?? []);

  protected readonly qName = signal('');
  protected readonly qKcal = signal<number | null>(null);
  protected readonly qP = signal<number | null>(null);
  protected readonly qC = signal<number | null>(null);
  protected readonly qF = signal<number | null>(null);

  protected kcal(m: CustomMeal): number {
    return sumMacros(m.items.map((i) => ({ kcal: (i.per100.kcal * i.grams) / 100, protein: 0, carbs: 0, fat: 0 }))).kcal;
  }

  protected names(m: CustomMeal): string {
    return m.items.map((i) => i.name).join(', ');
  }

  protected back(): void {
    void this.router.navigate(['/diario']);
  }

  protected async add(p: PickedFood): Promise<void> {
    await this.store.addFoodEntry(this.date(), this.meal(), p.food, p.grams);
    this.flash(`✓ ${p.food.name} añadido`);
  }

  protected async addMeal(m: CustomMeal): Promise<void> {
    await this.store.addItemsAsEntries(this.date(), this.meal(), m.items);
    this.flash(`✓ ${m.name} añadida`);
  }

  protected async addQuick(): Promise<void> {
    await this.store.addQuickCalories(this.date(), this.meal(), this.qName().trim(), {
      kcal: Number(this.qKcal()) || 0,
      protein: Number(this.qP()) || 0,
      carbs: Number(this.qC()) || 0,
      fat: Number(this.qF()) || 0,
    });
    this.qName.set('');
    this.qKcal.set(null);
    this.qP.set(null);
    this.qC.set(null);
    this.qF.set(null);
    this.flash('✓ Calorías añadidas');
  }

  private flash(text: string): void {
    this.msg.set(text);
    setTimeout(() => this.msg.set(''), 2500);
  }
}
