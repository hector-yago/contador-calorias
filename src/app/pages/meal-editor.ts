import { DecimalPipe, Location } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomMeal, MealItem } from '../core/models';
import { Store } from '../core/store';
import { FoodPicker, PickedFood } from '../ui/food-picker';

@Component({
  selector: 'app-meal-editor',
  imports: [FormsModule, DecimalPipe, FoodPicker],
  template: `
    <div class="overlay">
      <div class="page stack">
        <div class="row between">
          <button class="link" (click)="back()">‹ Cancelar</button>
          <strong>{{ isNew() ? 'Nueva comida habitual' : 'Editar comida habitual' }}</strong>
          <button class="link" [disabled]="!canSave()" (click)="save()">Guardar</button>
        </div>

        @if (adding()) {
          <div class="row between">
            <strong>Añadir alimento</strong>
            <button class="link" (click)="adding.set(false)">Cerrar</button>
          </div>
          <div class="tabs">
            <button [class.on]="addTab() === 'buscar'" (click)="addTab.set('buscar')">Buscar</button>
            <button [class.on]="addTab() === 'codigo'" (click)="addTab.set('codigo')">Código de barras</button>
          </div>
          @if (addTab() === 'buscar') {
            <app-food-picker mode="buscar" confirmLabel="Incluir" (picked)="addItem($event)" />
          } @else {
            <app-food-picker mode="codigo" confirmLabel="Incluir" (picked)="addItem($event)" />
          }
        } @else {
          <label class="field">Nombre
            <input placeholder="Ej. Desayuno diario" [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </label>

          <div class="card">
            @for (it of items(); track $index) {
              <div class="list-item">
                <span class="grow">{{ it.name }}<br /><span class="muted">{{ it.brand }}</span></span>
                <input class="g" type="number" inputmode="decimal" min="1" [ngModel]="it.grams" (ngModelChange)="setGrams($index, +$event)" />
                <span class="muted">g</span>
                <button class="link danger" (click)="remove($index)" aria-label="Quitar">✕</button>
              </div>
            } @empty {
              <p class="muted">Sin alimentos todavía.</p>
            }
            <div class="muted">Total: {{ total() | number: '1.0-0' }} kcal</div>
          </div>

          <button class="primary" (click)="adding.set(true)">+ Añadir alimento</button>

          @if (!isNew()) {
            <button class="danger" (click)="deleteMeal()">Eliminar comida habitual</button>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .g {
      width: 84px;
      text-align: right;
    }
  `,
})
export class MealEditor implements OnInit {
  private readonly store = inject(Store);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  protected readonly name = signal('');
  protected readonly items = signal<MealItem[]>([]);
  protected readonly adding = signal(false);
  protected readonly addTab = signal<'buscar' | 'codigo'>('buscar');
  protected readonly isNew = computed(() => this.id() === 'new');

  protected readonly total = computed(() => this.items().reduce((s, i) => s + (i.per100.kcal * i.grams) / 100, 0));
  protected readonly canSave = computed(() => this.name().trim().length > 0 && this.items().length > 0);

  async ngOnInit(): Promise<void> {
    if (!this.isNew()) {
      const m = await this.store.getMeal(Number(this.id()));
      if (m) {
        this.name.set(m.name);
        this.items.set(structuredClone(m.items));
      }
    }
  }

  protected back(): void {
    this.location.back();
  }

  protected addItem(p: PickedFood): void {
    this.items.update((l) => [
      ...l,
      { foodId: p.food.id, name: p.food.name, brand: p.food.brand, grams: p.grams, per100: p.food.per100 },
    ]);
    this.adding.set(false);
  }

  protected setGrams(i: number, g: number): void {
    this.items.update((l) => l.map((it, idx) => (idx === i ? { ...it, grams: g > 0 ? g : 0 } : it)));
  }

  protected remove(i: number): void {
    this.items.update((l) => l.filter((_, idx) => idx !== i));
  }

  protected async save(): Promise<void> {
    const meal: CustomMeal = {
      name: this.name().trim(),
      items: this.items().filter((i) => i.grams > 0),
    };
    if (!this.isNew()) meal.id = Number(this.id());
    await this.store.saveMeal(meal);
    this.back();
  }

  protected async deleteMeal(): Promise<void> {
    if (!window.confirm('¿Eliminar esta comida habitual? Lo ya registrado en el diario no cambia.')) return;
    await this.store.deleteMeal(Number(this.id()));
    this.back();
  }
}
