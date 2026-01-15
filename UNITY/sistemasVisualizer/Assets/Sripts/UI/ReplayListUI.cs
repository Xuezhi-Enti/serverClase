using System.Collections. Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;

public class ReplayListUI : MonoBehaviour
{
    [Header("UI References")]
    [SerializeField] private GameObject replayItemPrefab;
    [SerializeField] private Transform replayListContainer;
    [SerializeField] private TextMeshProUGUI statusText;
    [SerializeField] private Button refreshButton;
    [SerializeField] private Button backButton;
    
    private void Start()
    {
        // Subscribe to socket events
        SocketManager.Instance. OnReplayListReceived += OnReplayListReceived;
        
        // Button listeners
        refreshButton.onClick.AddListener(RefreshReplayList);
        backButton.onClick.AddListener(GoBack);
        
        // Request initial replay list
        RefreshReplayList();
    }
    
    private void RefreshReplayList()
    {
        statusText.text = "Loading replays...";
        SocketManager. Instance.RequestReplayList();
    }
    
    private void OnReplayListReceived(List<SocketManager.ReplayInfo> replays)
    {
        // Clear existing items
        foreach (Transform child in replayListContainer)
        {
            Destroy(child.gameObject);
        }
        
        if (replays.Count == 0)
        {
            statusText.text = "No replays available";
            return;
        }
        
        statusText. text = $"{replays.Count} replay(s) found";
        
        foreach (var replay in replays)
        {
            GameObject replayItem = Instantiate(replayItemPrefab, replayListContainer);
            
            //Setup replay item
            TextMeshProUGUI replayNameText = replayItem.transform.Find("ReplayName").GetComponent<TextMeshProUGUI>();
            TextMeshProUGUI replayInfoText = replayItem.transform. Find("Info").GetComponent<TextMeshProUGUI>();
            Button watchButton = replayItem.transform. Find("WatchButton").GetComponent<Button>();
            
            replayNameText.text = replay. roomName;
            replayInfoText.text = $"{replay.player1Name} vs {replay.player2Name}\n{replay.date}";
            
            //Setup watch button
            string replayId = replay.replayId;
            watchButton.onClick.AddListener(() => WatchReplay(replayId));
        }
    }
    
    private void WatchReplay(string replayId)
    {
        PlayerPrefs.SetString("SelectedReplayId", replayId);
        SocketManager.Instance.RequestReplayData(replayId);
        SceneManager.LoadScene("ReplayViewer");
    }
    
    private void GoBack()
    {
        SceneManager.LoadScene("MainMenu");
    }
    
    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance. OnReplayListReceived -= OnReplayListReceived;
        }
    }
}