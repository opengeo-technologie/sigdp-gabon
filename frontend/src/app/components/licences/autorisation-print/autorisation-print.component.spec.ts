import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutorisationPrintComponent } from './autorisation-print.component';

describe('AutorisationPrintComponent', () => {
  let component: AutorisationPrintComponent;
  let fixture: ComponentFixture<AutorisationPrintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutorisationPrintComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutorisationPrintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
