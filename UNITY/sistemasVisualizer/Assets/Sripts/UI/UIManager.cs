using UnityEngine;
using UnityEngine. UI;
using UnityEngine. SceneManagement;
using TMPro;

public class UIManager : MonoBehaviour
{
    [SerializeField] private GameObject mainMenuPanel;
    [SerializeField] private GameObject connectionPanel;
    [SerializeField] private TextMeshProUGUI statusText;
    
    [SerializeField] private Button connectButton;
    [SerializeField] private Button roomListButton;
    [SerializeField] private Button replayListButton;
    [SerializeField] private Button quitButton;
    
    private void Start()
    {
        // Setup button listeners
        connectButton?.onClick.AddListener(OnConnectClicked);
        roomListButton?.onClick.AddListener(OnRoomListClicked);
        replayListButton?.onClick.AddListener(OnReplayListClicked);
        quitButton?.onClick.AddListener(OnQuitClicked);
        
        // Subscribe to connection events
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnConnected += OnConnected;
            SocketManager.Instance.OnDisconnected += OnDisconnected;
        }
        
        // Show main menu initially
        ShowMainMenu();
    }
    
    private void OnConnectClicked()
    {
        connectionPanel.SetActive(true);
        mainMenuPanel.SetActive(false);
        statusText.text = "Connecting... ";
        
        SocketManager.Instance.Connect();
    }
    
    private void OnConnected()
    {
        statusText.text = "Connected! ";
        Invoke(nameof(ShowMainMenu), 1f);
    }
    
    private void OnDisconnected()
    {
        statusText. text = "Disconnected from server";
    }
    
    private void ShowMainMenu()
    {
        mainMenuPanel.SetActive(true);
        connectionPanel.SetActive(false);
    }
    
    private void OnRoomListClicked()
    {
        if (SocketManager.Instance. socket != null && SocketManager.Instance.socket. Connected)
        {
            SceneManager.LoadScene("RoomList");
        }
        else
        {
            statusText.text = "Please connect first! ";
        }
    }
    
    private void OnReplayListClicked()
    {
        if (SocketManager.Instance.socket != null && SocketManager.Instance.socket.Connected)
        {
            SceneManager. LoadScene("ReplayList");
        }
        else
        {
            statusText.text = "Please connect first!";
        }
    }
    
    private void OnQuitClicked()
    {
        Application.Quit();
    }
    
    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnConnected -= OnConnected;
            SocketManager.Instance.OnDisconnected -= OnDisconnected;
        }
    }
}