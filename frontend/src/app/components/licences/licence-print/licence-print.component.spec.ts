import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LicencePrintComponent } from './licence-print.component';

describe('LicencePrintComponent', () => {
  let component: LicencePrintComponent;
  let fixture: ComponentFixture<LicencePrintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LicencePrintComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LicencePrintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
