import warnings
import random
# quit to exit

warnings.filterwarnings("ignore")
scenes = {
    'start': {'duration': 0, 'period': 'noperiod', 'requiredChoices': ['cup', 'paperTowel']},
    'cup': {'duration': 0, 'karma': 1, 'requiredChoices':['NikoActsAsLucia', 'AngieActsAsLucia'], 'period': 'noperiod'},
    'paperTowel': {'duration': 0, 'karma': -1, 'requiredChoices':['NikoActsAsLucia', 'AngieActsAsLucia'], 'period': 'noperiod'},
    'NikoActsAsLucia': {'duration': 0, 'karma': 2,'requiredChoices': ['giveCigarrette', "dontGiveCigarrette"], 'period': 'noperiod'},
    'AngieActsAsLucia': {'duration': 0, 'karma': -1,'requiredChoices': ['giveCigarrette', "dontGiveCigarrette"], 'period': 'noperiod'},
    'giveCigarrette': {'duration': 45, 'karma': -3,'requiredChoices': ['speakWithAngie', 'playWithLucia'],'period': 'noperiod'},
    'dontGiveCigarrette': {'duration': 45, 'karma': 3,'requiredChoices': ['speakWithAngie', 'playWithLucia'],'period': 'noperiod'},
    'canon': {'duration': 45,
              'requiredChoices': ['speakWithAngie', 'playWithLucia'],
              'period': 'present'},
    'dontPlayWithLucia_speedrun': {'duration': 1, 
                                   'period': 'present',
                                   'karma': 0},
    'accept':{'duration':  17,
              'period': 'past',
              'karma': -3},
    'reject': {'duration': 3,
               'period': 'past',
               'karma': +3},
    'accept_speedrun':{'duration':  1,
                       'period': 'terminal',
                       'karma': -3},
    'reject_speedrun': {'duration': 1, 
                        'period': 'terminal',
                        'karma': 1},
    'speakWithAngie': {'duration': 1, 
                       'period': 'present', 
                       'requiredChoices': ['blackmail', 'manipulate'],
                       'karma': 2},
    'playWithLucia': {'duration': 7, 
                      'requiredChoices': ['accept', 'reject'],
                      'period': 'past',
                      'karma': -2
    },
    'playWithLucia_speedrun': {'duration': 1,
                               'period': 'past',
                               'karma': 0},
    'failBlackmail': {'duration': 2, 
                      'period': 'speaking',
                      'karma': -2},
    'winBlackmail_destruction': {'duration': 7, 
                                 'period': 'speaking',
                                 'karma': -2
                                 },
    'failManipulate_racism': {'duration': 3, 
                              'period': 'speaking',
                              'karma': -1},
    'winManipulate_platonic': {'duration': 10, 
                               'period': 'speaking',
                               'karma': -2},
    'dontSpeakWithAngie_dropout': {'duration': 9, 
                                   'period': 'present',
                                   'karma': 3},
    'god': {'duration': 14, 
            'period': 'terminal',
            'karma': 0},
    'heist': {'duration': 16, 
              'period': 'terminal',
              'karma': 0}
}


# Previously watched scenes: start, cup, NikoActsAsLucia, dontGiveCigarrette, speakWithAngie, failManipulate_racism, playWithLucia, reject, dontPlayWithLucia_speedrun, winBlackmail_destruction, playWithLucia_speedrun, accept
    


global watched, runtime, timeOut, speedrunDeathSpiralGodTrigger
watched = []
runtime = 0
timeOut = False
speedrunDeathSpiralGodTrigger = False

def remove(scene):
    if scene in options: options.remove(scene)

def add(scene):
    options.append(scene)

def period(scene):
    return scenes[scene]["period"]

def getKarma(scene):
    if scene in scenes:
        return scenes[scene]["karma"]
    return 0

# Used to normalise the distance between bad and good into a multiplier between 0 and 1
def scaler(x):
    max = 7
    if x > max:
        x = max
    if x < -max: 
        x = -max
    return (x - -max) / (max - -max)


watched = ["start"]

while not timeOut:
    curScene = watched[-1]
    
    print("\nPreviously watched scenes: " + ', '.join(str(watchedScene) for watchedScene in watched) )
    print(f"\nCurrently watching: {curScene} \nRuntime: {scenes[curScene]['duration']} mins")

    runtime = sum([scenes[watchedScene]["duration"] for watchedScene in watched])

    print("Total show runtime: ", runtime, "mins")

    if curScene in ['god', 'heist']:
        print("\n\n\n")
        print("Final karma: ", karma)
        print("Final runtime: ", runtime)
        quit()
   
    options = []

    conditionsForWinManipulate = 'dontSpeakWithAngie_dropout' in watched or 'winBlackmail_destruction' in watched
    conditionsForWinBlackmail = 'playWithLucia' in watched
    
    if 'requiredChoices' not in scenes[curScene]: 
        options = ['speakWithAngie', 'playWithLucia']
    
        playWithLuciaIsComplete = "reject" in watched and "accept" in watched
        speakWithAngieComplete = "winManipulate_platonic" in watched and "winBlackmail_destruction" in watched

        # Break apart speak with Angie into its components after you have them
        if "speakWithAngie" in watched or (playWithLuciaIsComplete and "dontSpeakWithAngie_dropout" in watched):
            add("failBlackmail")
            add("failManipulate_racism")

        # After failing, only offer "blackmail" again if win condition now unlocked
        if conditionsForWinBlackmail: 
            remove("failBlackmail")
            if "speakWithAngie" in watched:
                add("winBlackmail_destruction")


        # After failing, only offer "manipulate" again if win condition now unlocked
        if conditionsForWinManipulate: 
            remove("failManipulate_racism")
            if "speakWithAngie" in watched:
                add("winManipulate_platonic")

            
        # Split playWithLucia into its two options
        if "playWithLucia" in watched:
            remove('playWithLucia')
            add("reject")
            add("accept")


        # After finishing canon speedrun, you should only have choices from that point forward
        if curScene == "dontPlayWithLucia_speedrun": 
            remove('accept')
            remove('reject')

        

        # Dropout is a late game option
        if len(watched) > 6:
            add('dontSpeakWithAngie_dropout')
        

        
        speedrunDeathSpiralGodTrigger = watched.count("accept_speedrun") + watched.count("reject_speedrun") == 3
        
        options = [scene for scene in options if scene not in watched]

        if playWithLuciaIsComplete:
            add("accept_speedrun")
            add("reject_speedrun")

        if curScene == "reject":
            remove("reject_speedrun")
        elif curScene == "accept":
            remove("accept_speedrun")

        if 'winManipulate' in watched:
            remove("failBlackmail")
            remove("winBlackmail")
            remove("winManipulate_platonic")
            remove("failManipulate_racism")

        options = list(set(options))


    
    
    elif 'requiredChoices' in scenes[curScene]:
        if curScene == "speakWithAngie":
            if conditionsForWinBlackmail:
                add('winBlackmail_destruction')
            else: 
                add('failBlackmail')

            if conditionsForWinManipulate:
                add('winManipulate_platonic')
            else: 
                add('failManipulate_racism')
        else: 
            options = scenes[curScene]['requiredChoices']
            

        

    choices = []

    
    # Karma Calculation
    pairsOfSins = [
                   ['cup', 'paperTowel'],
                   ['NikoActsAsLucia', 'AngieActsAsLucia'],
                   ['dontGiveCigarrette', 'giveCigarrette'],
                   ['speakWithAngie', 'playWithLucia'],
                   ['reject', 'accept'], 
                  ]
    karma = 0


    for currentPair in pairsOfSins:
        orderedPair = []
        for index, scene in enumerate(watched):
            if scene in currentPair and len(orderedPair) < 2:
                orderedPair.append(scene)
        while len(orderedPair) < 2:
            orderedPair.append(None)

        if currentPair[0] in watched and currentPair[1] in watched:
            distanceBetweenGoodAndBad = watched.index(currentPair[0]) - watched.index(currentPair[1])
            karma += getKarma(orderedPair[0]) + (scaler(distanceBetweenGoodAndBad))*getKarma(orderedPair[1])
        else: 
            karma += getKarma(orderedPair[0])
    karma = round(karma, 1)
    print("Karma: ", karma)


    # Checking terminal exits
    if karma < -10: 
        choices = ['god', 'god']
    
    conditionsForForcedGodEnding = (watched[-1] == "winBlackmail_destruction") or speedrunDeathSpiralGodTrigger
    
    if runtime >= 68:
        remove('playWithLucia')
    if runtime >= 68 and curScene != 'playWithLucia':
        remove('accept') # longest scene so requires a special case

    if len(options) > 2 and runtime <= 75:
        choices = options[0:2]
    else: 
        if runtime >= 75:
            choices = [] # we only gettin' terminal choices
        else:
            choices = options.copy() # we can get terminal choices mixed in with real ones
        HEISTKARMACUTOFF = 3
        GODKARMACUTOFF = -0.5
        if karma >= HEISTKARMACUTOFF: 
            while len(choices) < 2:
                choices.append('heist')
        elif karma <= GODKARMACUTOFF or conditionsForForcedGodEnding:
            while len(choices) < 2:
                choices.append('god')
        else:
            choices.append('god')
            if len(choices) < 2:
                choices.append('heist')




        # Simply checks if the first choice is potentially in the wrong place. If so, it swaps them.
        if (((period(curScene) == 'present') or period(curScene) == 'speaking') and period(choices[0])) == 'past' or ((period(curScene) == 'past') and (period(choices[0]) == 'speaking' or period(choices[0]) == 'present')):
            choices[0], choices[1] = choices[1], choices[0]



    if len(choices) < 2:
        KeyError

    if "accept_speedrun" in options and "accept_speedrun" in watched:
        choices[0] == "accept_speedrun"
    elif "reject_speedrun" in options and "reject_speedrun" in watched:
        choices[0] == "reject_speedrun"
            

    userChoiceValid = False

    playWithLuciaSpeedrun = False
    dontPlayWithLuciaSpeedrun = False

    while not userChoiceValid: 
        for i in range(0,2):

            # Present -> Past
            if (period(curScene) in ['speaking', 'present']) and (choices[i] in ['reject', 'accept', 'reject_speedrun', 'accept_speedrun']):
                print(f"(Be prepared that choosing {choices[i]} will trigger playWithLucia_speedrun, then straight into {choices[i]})")

            # Past -> Present
            if period(curScene) == "past" and period(choices[i]) in ['present', 'speaking']:
                print(f"(Be prepared that choosing {choices[i]} will trigger a dontPlayWithLucia_speedrun right before it, then straight into {choices[i]})")

        # print(options)
        # print(choices)
        userChoice = input('                         \x1b[42m' + choices[0] +  '\033[1;37;40m     OR    \x1b[101m' +  choices[1] + '? \033[1;37;40m ')

        # print('                         \x1b[44m' + choices[0] +  '\033[1;37;40m     OR    \x1b[101m' +  choices[1] + '? \033[1;37;40m ')
        # userChoice = str(random.randint(1,2))
        # print("User choice", userChoice)

        if userChoice in ["green", "red", "1", "2"]:
            userChoiceValid = True

            if userChoice == "green" or userChoice == "1":
                userChoice = choices[0]
            elif userChoice == "red" or userChoice == "2":
                userChoice = choices[1]
            
            # If the scenes are in the same time period, no speedruns are necessary

            if period(curScene) in ['speaking', 'present'] and (userChoice == 'reject' or userChoice == 'accept'):
                print(f" \n\n\n\n\n SPEEDRUN TRIGGERED: Doing playWithLucia_speedrun straight into {userChoice}!")
                watched.append('playWithLucia_speedrun')
            
            if period(curScene) == "past" and (period(userChoice) in ['present', 'speaking']):
                print(f" \n\n\n\n\n SPEEDRUN TRIGGERED: Doing dontPlayWithLucia_speedrun straight into {userChoice}!")
                watched.append('dontPlayWithLucia_speedrun')

            watched.append(userChoice)



        elif userChoice == "undo":
            if len(watched) == 1:
                userChoiceValid = False
                print("Can't undo canon!")
            else: 
                userChoiceValid = True
                goneScene = watched.pop()
                print("\n\n\n\n")
                print(f"UNDONE WATCHING  {goneScene}")
                print("\n\n\n")
        else: 
            userChoiceValid = False
            print("Invalid Choice.")

        





    
    

    # If you exhaust all of the Grad options before going back to play with Lucia even once, then you'll only have Play With Lucia, so you won't have two new options. That's fine
    # If this happens, it will give you something you've already done and it'll be god and early
    # Well to be honest, you don't have to do playWithLucia for the play to be complete. 

    if curScene not in scenes:
        KeyError
