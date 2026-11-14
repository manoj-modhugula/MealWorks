/** Sample dishes and the shared photo lookup used by menu screens. */

type SampleDish = {
  name: string;
  meal: "breakfast" | "lunch";
  station: string;
  photo: string;
};

export const SAMPLE_DISHES: SampleDish[] = [
  {
    name: "Spinach & Mushroom Scramble",
    meal: "breakfast",
    station: "Breakfast Kitchen",
    photo: "/images/breakfast.webp",
  },
  {
    name: "Greek Yogurt & Berries",
    meal: "breakfast",
    station: "Yogurt Bar",
    photo: "/images/yogurt.webp",
  },
  {
    name: "Banana & Walnut Oatmeal",
    meal: "breakfast",
    station: "Breakfast Kitchen",
    photo: "/images/oatmeal.webp",
  },
  {
    name: "Buttermilk Pancakes",
    meal: "breakfast",
    station: "Breakfast Kitchen",
    photo: "/images/pancakes.webp",
  },
  {
    name: "Butter Croissant",
    meal: "breakfast",
    station: "Bakery",
    photo: "/images/croissant.webp",
  },
  {
    name: "Belgian Waffle",
    meal: "breakfast",
    station: "Breakfast Kitchen",
    photo: "/images/waffles.webp",
  },
  {
    name: "Pollo a la Brasa with Aji Verde",
    meal: "lunch",
    station: "Chef's Table",
    photo: "/images/lunch.webp",
  },
  {
    name: "Sofrito Rice",
    meal: "lunch",
    station: "Chef's Table",
    photo: "/images/rice.webp",
  },
  {
    name: "Refried Beans",
    meal: "lunch",
    station: "Chef's Table",
    photo: "/images/beans.webp",
  },
  {
    name: "Herb-Roasted Salmon",
    meal: "lunch",
    station: "Grill",
    photo: "/images/herb-salmon.webp",
  },
  {
    name: "Maple-Roasted Carrots",
    meal: "lunch",
    station: "Seasonal",
    photo: "/images/roasted-carrots.webp",
  },
  {
    name: "Mediterranean Lentil Bowl",
    meal: "lunch",
    station: "Plant Kitchen",
    photo: "/images/lentil-bowl.webp",
  },
  {
    name: "Heirloom Caprese Salad",
    meal: "lunch",
    station: "Salad & Antipasti",
    photo: "/images/caprese.webp",
  },
  {
    name: "Quinoa-Stuffed Peppers",
    meal: "lunch",
    station: "Plant Kitchen",
    photo: "/images/stuffed-peppers.webp",
  },
  {
    name: "Spinach & Cheese Empanadas with Chimichurri",
    meal: "lunch",
    station: "Chef's Table",
    photo: "/images/empanadas.webp",
  },
  {
    name: "Eggplant Parm Pizza",
    meal: "lunch",
    station: "Hearth",
    photo: "/images/pizza.webp",
  },
  {
    name: "Creamy Mushroom Tagliatelle",
    meal: "lunch",
    station: "Pasta Kitchen",
    photo: "/images/pasta.webp",
  },
  {
    name: "Mediterranean Grain Bowl",
    meal: "lunch",
    station: "Salad Compose",
    photo: "/images/salad.webp",
  },
  {
    name: "Greek Salad",
    meal: "lunch",
    station: "Salad Compose",
    photo: "/images/greek-salad.webp",
  },
  {
    name: "Roasted Beet & Orange Salad",
    meal: "lunch",
    station: "Salad Compose",
    photo: "/images/beet-salad.webp",
  },
  {
    name: "Classic Caesar Salad",
    meal: "lunch",
    station: "Salad Compose",
    photo: "/images/caesar-salad.webp",
  },
  {
    name: "Creamy Potato Salad",
    meal: "lunch",
    station: "Salad Compose",
    photo: "/images/potato-salad.webp",
  },
  {
    name: "Italian Pasta Salad",
    meal: "lunch",
    station: "Salad Compose",
    photo: "/images/pasta-salad.webp",
  },
];

const photosByDish = new Map(
  SAMPLE_DISHES.map((dish) => [dish.name, dish.photo]),
);
export function dishPhoto(name: string): string | null {
  return photosByDish.get(name) ?? null;
}
