import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SurveillanceDashboardComponent } from './surveillance-dashboard.component';

describe('SurveillanceDashboardComponent', () => {
  let component: SurveillanceDashboardComponent;
  let fixture: ComponentFixture<SurveillanceDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SurveillanceDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SurveillanceDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
