import { Component } from "@angular/core";
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from "primeng/accordion";
import { Divider } from "primeng/divider";
import { Tag } from "primeng/tag";
import { Card } from "primeng/card";

@Component({
	selector: "app-guide",
	imports: [Accordion, AccordionPanel, AccordionHeader, AccordionContent, Divider, Tag, Card],
	templateUrl: "./guide.html",
	styleUrl: "./guide.css",
})
export class Guide {}
