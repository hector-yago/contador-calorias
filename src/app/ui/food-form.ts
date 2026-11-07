import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Food } from '../core/models';
import { Store } from '../core/store';

/** Alta manual de un alimento (valores por 100 g). */
@Component({
  selector: 'app-food-form',
  imports: [FormsModule],
  template: `
    <div class="card stack">
      <h2>Crear alimento</h2>
      <label class="field">Nombre
        <input [ngModel]="name()" (ngModelChange)="name.set($event)" />
      </label>
      <div class="grid2">
        <label class="field">Marca (opcional)
          <input [ngModel]="brand()" (ngModelChange)="brand.set($event)" />
        </label>
        <label class="field">Código de barras (opcional)
          <input inputmode="numeric" [ngModel]="barcode()" (ngModelChange)="barcode.set($event)" />
        </label>
      </div>
      <div class="muted">Valores nutricionales por 100 g (o 100 ml)</div>
      <div class="grid2">
        <label class="field">Calorías (kcal)
          <input type="number" inputmode="decimal" min="0" [ngModel]="kcal()" (ngModelChange)="kcal.set($event)" />
        </label>
        <label class="field">Proteínas (g)
          <input type="number" inputmode="decimal" min="0" [ngModel]="protein()" (ngModelChange)="protein.set($event)" />
        </label>
        <label class="field">Carbohidratos (g)
          <input type="number" inputmode="decimal" min="0" [ngModel]="carbs()" (ngModelChange)="carbs.set($event)" />
        </label>
        <label class="field">Grasas (g)
          <input type="number" inputmode="decimal" min="0" [ngModel]="fat()" (ngModelChange)="fat.set($event)" />
        </label>
      </div>
      <label class="field">Ración en gramos (opcional)
        <input type="number" inputmode="decimal" min="0" [ngModel]="serving()" (ngModelChange)="serving.set($event)" />
      </label>
      <div class="row">
        <button class="grow" (click)="cancelled.emit()">Cancelar</button>
        <button class="grow primary" [disabled]="!valid()" (click)="save()">Guardar</button>
      </div>
    </div>
  `,
})
export class FoodForm {
  private readonly store = inject(Store);
  readonly initialBarcode = input<string>();
  readonly saved = output<Food>();
  readonly cancelled = output<void>();

  protected readonly name = signal('');
  protected readonly brand = signal('');
  protected readonly barcode = signal('');
  protected readonly kcal = signal<number | null>(null);
  protected readonly protein = signal<number | null>(null);
  protected readonly carbs = signal<number | null>(null);
  protected readonly fat = signal<number | null>(null);
  protected readonly serving = signal<number | null>(null);

  constructor() {
    queueMicrotask(() => {
      const b = this.initialBarcode();
      if (b) this.barcode.set(b);
    });
  }

  protected valid(): boolean {
    return this.name().trim().length > 0 && this.kcal() !== null && Number(this.kcal()) >= 0;
  }

  protected async save(): Promise<void> {
    const code = this.barcode().trim();
    const food = await this.store.saveFood({
      barcode: code || undefined,
      name: this.name().trim(),
      brand: this.brand().trim() || undefined,
      per100: {
        kcal: Number(this.kcal()) || 0,
        protein: Number(this.protein()) || 0,
        carbs: Number(this.carbs()) || 0,
        fat: Number(this.fat()) || 0,
      },
      servingG: Number(this.serving()) > 0 ? Number(this.serving()) : undefined,
      source: 'manual',
    });
    this.saved.emit(food);
  }
}
