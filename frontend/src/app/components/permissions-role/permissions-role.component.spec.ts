import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionsRoleComponent } from './permissions-role.component';

describe('PermissionsRoleComponent', () => {
  let component: PermissionsRoleComponent;
  let fixture: ComponentFixture<PermissionsRoleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionsRoleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionsRoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
