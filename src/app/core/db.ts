import Dexie, { Table } from 'dexie';
import { CustomMeal, Entry, Food, Profile, WeightEntry } from './models';

export class AppDb extends Dexie {
  profile!: Table<Profile, string>;
  weights!: Table<WeightEntry, string>;
  foods!: Table<Food, string>;
  entries!: Table<Entry, number>;
  meals!: Table<CustomMeal, number>;

  constructor(name = 'contador-calorias') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      weights: 'date',
      foods: 'id, barcode, lastUsed',
      entries: '++id, date',
      meals: '++id, name',
    });
  }
}
