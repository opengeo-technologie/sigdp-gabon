import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ArmementCooperativeService } from "../../../services/armement-cooperative.service";
import { ActivatedRoute, RouterModule } from "@angular/router";

@Component({
  selector: "app-armement-cooperative-detail",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./armement-cooperative-detail.component.html",
  styleUrl: "./armement-cooperative-detail.component.scss",
})
export class ArmementCooperativeDetailComponent {
  armementCooperative: any = null;

  constructor(
    private armementService: ArmementCooperativeService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    // Ici, vous pouvez récupérer les détails de l'armement/coopérative à partir d'un service
    // Par exemple, en utilisant un ID passé via la route
    this.route.params.subscribe((params) => {
      const id = params["id"];
      this.armementService.getArmementCooperative(id).subscribe((data) => {
        this.armementCooperative = data;
      });
    });
  }
}
