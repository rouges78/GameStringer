# GameStringer fixture — micro visual novel
define e = Character("Eileen", color="#c8ffc8")
define m = Character("Marcus")

label start:
    scene bg room
    with fade

    e "Welcome to the kingdom of Eldoria!"
    m "The dragon awaits in the northern tower."

    menu:
        "Fight the dragon":
            jump fight
        "Run away":
            jump coward

label fight:
    e "You chose bravery, [player_name]!"
    "The battle begins..."
    return

label coward:
    m "Perhaps another day, then."
    return
